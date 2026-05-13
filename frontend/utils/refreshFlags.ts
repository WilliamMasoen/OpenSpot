let _listingsStale = false;

export function markListingsStale() {
  _listingsStale = true;
}

export function consumeListingsStale(): boolean {
  const stale = _listingsStale;
  _listingsStale = false;
  return stale;
}
