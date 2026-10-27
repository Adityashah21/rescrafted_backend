const slugifyPkg = require('slugify');

/**
 * Creates a URL-safe lowercase slug from a string, appending an optional unique random suffix
 */
const createSlug = (text, appendRandom = false) => {
  const baseSlug = slugifyPkg(text, {
    lower: true,
    strict: true,
    trim: true
  });

  if (appendRandom) {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${baseSlug}-${randomSuffix}`;
  }

  return baseSlug;
};

module.exports = createSlug;
