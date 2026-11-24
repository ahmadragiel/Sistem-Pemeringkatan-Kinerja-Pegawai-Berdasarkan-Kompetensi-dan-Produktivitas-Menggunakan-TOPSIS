export function buildPagination({ total, page, pageSize, basePath, query = {} }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  const makeUrl = (targetPage) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value);
      }
    }
    if (targetPage > 1) {
      params.set('hal', String(targetPage));
    } else {
      params.delete('hal');
    }
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const pages = [];
  for (let index = 1; index <= totalPages; index += 1) {
    if (
      index === 1 ||
      index === totalPages ||
      Math.abs(index - current) <= 1
    ) {
      pages.push({ number: index, url: makeUrl(index), current: index === current });
    } else if (pages[pages.length - 1]?.gap !== true) {
      pages.push({ gap: true });
    }
  }

  return {
    total,
    page: current,
    pageSize,
    totalPages,
    from: total === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(current * pageSize, total),
    previousUrl: current > 1 ? makeUrl(current - 1) : null,
    nextUrl: current < totalPages ? makeUrl(current + 1) : null,
    pages,
  };
}
