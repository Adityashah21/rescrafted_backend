/**
 * Standard pagination parser and metadata builder
 */
const getPagination = (query, defaultLimit = 12, maxLimit = 50) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const requestedLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, requestedLimit), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const formatPaginationMeta = (total, page, limit) => {
  const numLimit = parseInt(limit, 10);
  const numPage = parseInt(page, 10);
  const totalPages = Math.ceil(total / numLimit) || 1;
  return {
    page: numPage,
    limit: numLimit,
    total,
    totalPages,
    hasNextPage: numPage < totalPages,
    hasPrevPage: numPage > 1
  };
};

module.exports = {
  getPagination,
  formatPaginationMeta
};
