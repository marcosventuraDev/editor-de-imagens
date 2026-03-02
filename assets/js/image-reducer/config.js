// /assets/js/image-reducer/config.js
export const DEFAULT_MAX_IMAGES = 6;

export const DEFAULT_RULES = {
  maxW: 736,
  maxH: 736,
  maxBytes: 1 * 1024 * 1024
};

export function createConfig(overrides = {}) {
  return {
    maxImages: Number(overrides.maxImages ?? DEFAULT_MAX_IMAGES),
    rules: {
      ...DEFAULT_RULES,
      ...(overrides.rules || {})
    }
  };
}