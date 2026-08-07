/**
 * Storm Rainbow Engine
 * --------------------
 * Moteur déterministe de traduction colorimétrique pour Rainbow Glass.
 *
 * L'utilisateur fournit uniquement 1–2 couleurs de marque.
 * Storm détermine en interne un comportement PRISMATIC / PEARL / TINTED,
 * puis produit les variables optiques utilisées par Rainbow Glass.
 *
 * Aucun choix "Prismatic / Pearl / Tinted" n'est exposé dans l'interface.
 */
(function (global) {
  'use strict';

  const FALLBACK_PRIMARY = '#1E1D1E';
  const FALLBACK_SECONDARY = '#C2AF7E';

  function clamp(v, min = 0, max = 1) {
    return Math.max(min, Math.min(max, v));
  }

  function normalizeHex(value, fallback = FALLBACK_PRIMARY) {
    const raw = String(value || '').trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(raw)) return raw;
    if (/^#[0-9A-F]{3}$/.test(raw)) {
      return '#' + raw.slice(1).split('').map(c => c + c).join('');
    }
    return fallback;
  }

  function hexToRgb(hex) {
    const h = normalizeHex(hex).slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex({ r, g, b }) {
    const c = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0').toUpperCase();
    return `#${c(r)}${c(g)}${c(b)}`;
  }

  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * (((b - r) / d) + 2);
      else h = 60 * (((r - g) / d) + 4);
      if (h < 0) h += 360;
    }
    return { h, s, l };
  }

  function relativeLuminance(rgb) {
    const channel = c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function mix(a, b, amount = 0.5) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const t = clamp(amount);
    return rgbToHex({
      r: A.r + (B.r - A.r) * t,
      g: A.g + (B.g - A.g) * t,
      b: A.b + (B.b - A.b) * t
    });
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${clamp(alpha)})`;
  }

  function hueDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  }

  function colorInfo(hex) {
    const normalized = normalizeHex(hex);
    const rgb = hexToRgb(normalized);
    const hsl = rgbToHsl(rgb);
    const luminance = relativeLuminance(rgb);

    // Une couleur très sombre/claire ou très peu saturée se comporte comme un neutre optique.
    const neutral =
      hsl.s < 0.14 ||
      luminance < 0.035 ||
      luminance > 0.94;

    return { hex: normalized, rgb, hsl, luminance, neutral };
  }

  function scores(primary, secondary) {
    const p = colorInfo(primary);
    const s = colorInfo(secondary);
    const chromatic = [p, s].filter(c => !c.neutral);
    const avgSat = (p.hsl.s + s.hsl.s) / 2;
    const maxSat = Math.max(p.hsl.s, s.hsl.s);
    const hueGap = hueDistance(p.hsl.h, s.hsl.h);
    const luminanceGap = Math.abs(p.luminance - s.luminance);

    let prismatic = 0.08;
    let pearl = 0.12;
    let tinted = 0.08;

    if (chromatic.length === 2) {
      prismatic += avgSat * 0.58;
      prismatic += clamp(hueGap / 150) * 0.28;
      prismatic += clamp(1 - Math.abs(hueGap - 105) / 105) * 0.08;
      pearl += (1 - avgSat) * 0.30;
      tinted += clamp(luminanceGap - 0.48, 0, 0.45) * 0.20;
    } else if (chromatic.length === 1) {
      const accent = chromatic[0];
      if (accent.hsl.s > 0.58) {
        tinted += 0.54 + accent.hsl.s * 0.20;
        pearl += 0.15;
      } else {
        pearl += 0.62;
        tinted += 0.12;
      }
    } else {
      pearl += 0.78;
    }

    // Deux couleurs sourdes / premium : priorité au Pearl.
    if (avgSat < 0.34) pearl += 0.34;

    // Une seule couleur extrêmement vive face à un neutre : priorité au Tinted.
    if (chromatic.length === 1 && maxSat > 0.72) tinted += 0.22;

    // En cas de doute, Storm choisit la solution la moins chromatique.
    const total = prismatic + pearl + tinted;
    return {
      prismatic: prismatic / total,
      pearl: pearl / total,
      tinted: tinted / total
    };
  }

  function selectMode(result) {
    const ranked = Object.entries(result).sort((a, b) => b[1] - a[1]);
    const [first, second] = ranked;
    // Si le choix est peu net, avantage volontaire à Pearl/Tinted.
    if ((first[1] - second[1]) < 0.08 && first[0] === 'prismatic') {
      return result.pearl >= result.tinted ? 'pearl' : 'tinted';
    }
    return first[0];
  }

  function derive(colors = []) {
    const primary = normalizeHex(colors[0], FALLBACK_PRIMARY);
    const secondary = normalizeHex(colors[1], primary || FALLBACK_SECONDARY);
    const p = colorInfo(primary);
    const s = colorInfo(secondary);
    const resultScores = scores(primary, secondary);
    const mode = selectMode(resultScores);

    const chromaticColors = [p, s].filter(c => !c.neutral);
    const strongestAccent = chromaticColors
      .slice()
      .sort((a, b) => b.hsl.s - a.hsl.s)[0]?.hex || secondary;

    let brandInfluence;
    let palette;

    if (mode === 'prismatic') {
      brandInfluence = clamp(
        0.62 + ((p.hsl.s + s.hsl.s) / 2) * 0.24,
        0.62,
        0.88
      );
      palette = {
        staticPrimary: primary,
        staticSecondary: secondary,
        titleStart: primary,
        titleBridge: mix(primary, '#9B8FE5', 0.46),
        titleEnd: secondary,
        glowA: rgba(primary, 0.20),
        glowB: rgba(secondary, 0.14),
        prismA: rgba(primary, 0.22),
        prismB: 'rgba(121,207,226,.25)',
        prismC: 'rgba(166,130,231,.30)',
        prismD: rgba(secondary, 0.22)
      };
    } else if (mode === 'tinted') {
      brandInfluence = clamp(0.18 + strongestAccent && colorInfo(strongestAccent).hsl.s * 0.12, 0.18, 0.32);
      palette = {
        staticPrimary: primary,
        staticSecondary: strongestAccent,
        titleStart: strongestAccent,
        titleBridge: '#9FAFBC',
        titleEnd: mix(strongestAccent, '#FFFFFF', 0.48),
        glowA: rgba('#C8D7E0', 0.16),
        glowB: rgba(strongestAccent, 0.075),
        prismA: 'rgba(185,206,219,.22)',
        prismB: 'rgba(207,219,232,.25)',
        prismC: rgba(strongestAccent, 0.10),
        prismD: 'rgba(225,229,235,.18)'
      };
    } else {
      // PEARL : la marque reste très présente au repos,
      // mais l'irisation appartient à la lumière et non à la charte.
      brandInfluence = 0.28;
      const warm = s.neutral ? primary : secondary;
      palette = {
        staticPrimary: primary,
        staticSecondary: secondary,
        titleStart: p.neutral ? '#242424' : primary,
        titleBridge: '#AEBCCA',
        titleEnd: mix(warm, '#FFFFFF', 0.34),
        glowA: 'rgba(190,210,222,.15)',
        glowB: rgba(warm, 0.08),
        prismA: 'rgba(185,207,220,.22)',
        prismB: 'rgba(214,224,234,.26)',
        prismC: 'rgba(207,198,222,.24)',
        prismD: rgba(warm, 0.16)
      };
    }

    return {
      mode,
      scores: resultScores,
      brandInfluence,
      primary,
      secondary,
      palette,
      cssVars: {
        '--rg-brand-influence': brandInfluence.toFixed(3),
        '--rg-static-primary': palette.staticPrimary,
        '--rg-static-secondary': palette.staticSecondary,
        '--rg-title-start': palette.titleStart,
        '--rg-title-bridge': palette.titleBridge,
        '--rg-title-end': palette.titleEnd,
        '--rg-glow-a': palette.glowA,
        '--rg-glow-b': palette.glowB,
        '--rg-prism-a': palette.prismA,
        '--rg-prism-b': palette.prismB,
        '--rg-prism-c': palette.prismC,
        '--rg-prism-d': palette.prismD
      }
    };
  }

  function cssVariables(colors) {
    return derive(colors).cssVars;
  }

  global.StormRainbowEngine = Object.freeze({
    derive,
    cssVariables,
    normalizeHex
  });
})(window);
