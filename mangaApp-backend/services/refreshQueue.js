const inFlightRefreshes = new Map();

export const runSingleFlight = async (key, task) => {
  if (inFlightRefreshes.has(key)) {
    return inFlightRefreshes.get(key);
  }

  const promise = (async () => {
    try {
      return await task();
    } finally {
      inFlightRefreshes.delete(key);
    }
  })();

  inFlightRefreshes.set(key, promise);
  return promise;
};

export const getRefreshQueueSize = () => inFlightRefreshes.size;
