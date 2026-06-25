using Microsoft.EntityFrameworkCore;
using OpenSpot.Audit;
using OpenSpot.Common;
using OpenSpot.Data;
using OpenSpot.Listings.DTOs;
using OpenSpot.Listings.Geocoding;
using OpenSpot.Listings.Interfaces;
using OpenSpot.Listings.Models;
using OpenSpot.Ratings.Models;

namespace OpenSpot.Listings.Services
{
    public class ListingService : IListingService
    {
        private readonly ApplicationDbContext _context;
        private readonly IGeocodingService _geocoding;
        private readonly IAuditService _audit;

        public ListingService(ApplicationDbContext context, IGeocodingService geocoding, IAuditService audit)
        {
            _context = context;
            _geocoding = geocoding;
            _audit = audit;
        }

        public async Task<ServiceResult<PagedResult<GetListingDto>?>> GetListingsAsync(string? requesterId, int page, int pageSize, string? sortBy, int? maxPrice, double? lat, double? lng, CancellationToken token)
        {
            var baseQuery = _context.Listing.AsNoTracking().Where(l => l.IsAvailable);

            if (maxPrice.HasValue)
                baseQuery = baseQuery.Where(l => l.Price <= maxPrice.Value);

            bool nearestSort = sortBy == "nearest" && lat.HasValue && lng.HasValue;

            IQueryable<Listing> query;
            if (nearestSort)
                query = baseQuery.Include(l => l.Images).Include(l => l.Owner);
            else
                query = sortBy switch
                {
                    "price_asc" => baseQuery.OrderBy(l => l.Price),
                    "price_desc" => baseQuery.OrderByDescending(l => l.Price),
                    _ => baseQuery.OrderByDescending(l => l.CreatedAt),
                };

            var allListings = nearestSort
                ? await query.ToListAsync(token)
                : null;

            List<Listing> pagedListings;
            int totalCount;

            if (nearestSort)
            {
                var sorted = allListings!
                    .OrderBy(l => l.Latitude.HasValue && l.Longitude.HasValue
                        ? HaversineKm(lat!.Value, lng!.Value, l.Latitude.Value, l.Longitude.Value)
                        : double.MaxValue)
                    .ToList();
                totalCount = sorted.Count;
                pagedListings = sorted.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            }
            else
            {
                totalCount = await query.CountAsync(token);
                pagedListings = await query
                    .Include(l => l.Images)
                    .Include(l => l.Owner)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync(token);
            }

            var favoriteIds = await GetFavoriteIdsAsync(requesterId, token);
            var ownerIds = pagedListings.Select(l => l.OwnerId).Distinct().ToList();
            var ratingStats = await GetOwnerRatingStatsAsync(ownerIds, token);
            var result = new PagedResult<GetListingDto>
            {
                Items = pagedListings.Select(l =>
                {
                    ratingStats.TryGetValue(l.OwnerId, out var stats);
                    return new GetListingDto(l, favoriteIds?.Contains(l.Id), stats.avg, stats.count);
                }).ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                HasMore = page * pageSize < totalCount,
            };

            return ServiceResult<PagedResult<GetListingDto>?>.Ok(result);
        }

        public async Task<ServiceResult<GetListingDto?>> GetListingByIdAsync(Guid id, string? requesterId, CancellationToken token)
        {
            var listing = await _context.Listing
                .AsNoTracking()
                .Include(l => l.Images)
                .Include(l => l.Owner)
                .FirstOrDefaultAsync(l => l.Id == id, token);
            if (listing is null)
                return ServiceResult<GetListingDto?>.Fail("Listing not found.", ResultStatus.NotFound);

            bool? isFavorited = null;
            if (requesterId != null)
                isFavorited = await _context.UserFavorites
                    .AnyAsync(f => f.UserId == requesterId && f.ListingId == id, token);

            var ratingStats = await GetOwnerRatingStatsAsync([listing.OwnerId], token);
            ratingStats.TryGetValue(listing.OwnerId, out var stats);

            return ServiceResult<GetListingDto?>.Ok(new GetListingDto(listing, isFavorited, stats.avg, stats.count));
        }

        public async Task<ServiceResult<List<GetListingDto>?>> GetMyListingsAsync(string ownerId, CancellationToken token)
        {
            var listings = await _context.Listing
                .AsNoTracking()
                .Include(l => l.Images)
                .Include(l => l.Owner)
                .Where(l => l.OwnerId == ownerId)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync(token);
            var ratingStats = await GetOwnerRatingStatsAsync([ownerId], token);
            ratingStats.TryGetValue(ownerId, out var stats);
            return ServiceResult<List<GetListingDto>?>.Ok(
                listings.Select(l => new GetListingDto(l, null, stats.avg, stats.count)).ToList());
        }

        public async Task<ServiceResult<GetListingDto?>> CreateNewListingAsync(string ownerId, CreateListingDto dto, CancellationToken token)
        {
            var exists = await _context.Listing.AnyAsync(l => l.Title == dto.Title && l.OwnerId == ownerId, token);
            if (exists)
                return ServiceResult<GetListingDto?>.Fail($"A listing named \"{dto.Title}\" already exists in your account.", ResultStatus.Conflict);

            double? lat = dto.Latitude;
            double? lng = dto.Longitude;
            if (lat == null || lng == null)
            {
                var coords = await _geocoding.GeocodeAsync(dto.Address, token);
                lat = coords?.Lat;
                lng = coords?.Lng;
            }

            var listing = new Listing
            {
                Title = dto.Title,
                Description = dto.Description,
                Address = dto.Address,
                Price = dto.Price,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                IsAvailable = true,
                CreatedAt = DateTime.UtcNow,
                OwnerId = ownerId,
                Latitude = lat,
                Longitude = lng,
            };

            await _context.Listing.AddAsync(listing, token);
            _audit.Log("listing.created", ownerId, "Listing", listing.Id.ToString(), $"title={listing.Title}");
            await _context.SaveChangesAsync(token);

            return ServiceResult<GetListingDto?>.Created(new GetListingDto(listing));
        }

        public async Task<ServiceResult<GetListingDto?>> UpdateListingAsync(Guid id, string requesterId, UpdateListingDto dto, CancellationToken token)
        {
            var listing = await _context.Listing.FindAsync([id], token);
            if (listing is null)
                return ServiceResult<GetListingDto?>.Fail("Listing not found.", ResultStatus.NotFound);

            if (listing.OwnerId != requesterId)
                return ServiceResult<GetListingDto?>.Fail("You do not own this listing.", ResultStatus.Forbidden);

            listing.Title = dto.Title;
            listing.Description = dto.Description;
            listing.Address = dto.Address;
            listing.Price = dto.Price;
            listing.StartDate = dto.StartDate;
            listing.EndDate = dto.EndDate;
            listing.IsAvailable = dto.IsAvailable;

            _audit.Log("listing.updated", requesterId, "Listing", id.ToString());
            await _context.SaveChangesAsync(token);
            return ServiceResult<GetListingDto?>.Ok(new GetListingDto(listing));
        }

        public async Task<ServiceResult<bool?>> DeleteListingAsync(Guid id, string requesterId, CancellationToken token)
        {
            var listing = await _context.Listing.FindAsync([id], token);
            if (listing is null)
                return ServiceResult<bool?>.Fail("Listing not found.", ResultStatus.NotFound);

            if (listing.OwnerId != requesterId)
                return ServiceResult<bool?>.Fail("You do not own this listing.", ResultStatus.Forbidden);

            _context.Listing.Remove(listing);
            _audit.Log("listing.deleted", requesterId, "Listing", id.ToString(), $"title={listing.Title}");
            await _context.SaveChangesAsync(token);
            return ServiceResult<bool?>.NoContent();
        }

        public async Task<ServiceResult<string?>> AddImageAsync(Guid listingId, string url, CancellationToken token)
        {
            var exists = await _context.Listing.AnyAsync(l => l.Id == listingId, token);
            if (!exists)
                return ServiceResult<string?>.Fail("Listing not found.", ResultStatus.NotFound);

            var image = new ListingImage
            {
                ListingId = listingId,
                Url = url,
                CreatedAt = DateTime.UtcNow,
            };

            await _context.ListingImages.AddAsync(image, token);
            await _context.SaveChangesAsync(token);
            return ServiceResult<string?>.Created(url);
        }

        public async Task<ServiceResult<List<GetListingDto>?>> SearchListingsAsync(
            string? q, double? lat, double? lng, double radiusKm, string? requesterId, CancellationToken token)
        {
            var query = _context.Listing.AsNoTracking().Include(l => l.Images).Include(l => l.Owner).Where(l => l.IsAvailable).AsQueryable();

            if (!string.IsNullOrWhiteSpace(q))
            {
                var pattern = $"%{q.Trim()}%";
                query = query.Where(l =>
                    EF.Functions.ILike(l.Title, pattern) ||
                    EF.Functions.ILike(l.Address, pattern));
            }

            var listings = await query.OrderByDescending(l => l.CreatedAt).ToListAsync(token);

            if (lat.HasValue && lng.HasValue)
            {
                listings = listings
                    .Where(l => l.Latitude.HasValue && l.Longitude.HasValue &&
                                HaversineKm(lat.Value, lng.Value, l.Latitude.Value, l.Longitude.Value) <= radiusKm)
                    .ToList();
            }

            var favoriteIds = await GetFavoriteIdsAsync(requesterId, token);
            var ownerIds = listings.Select(l => l.OwnerId).Distinct().ToList();
            var ratingStats = await GetOwnerRatingStatsAsync(ownerIds, token);
            return ServiceResult<List<GetListingDto>?>.Ok(
                listings.Select(l =>
                {
                    ratingStats.TryGetValue(l.OwnerId, out var stats);
                    return new GetListingDto(l, favoriteIds?.Contains(l.Id), stats.avg, stats.count);
                }).ToList());
        }

        public async Task<ServiceResult<bool?>> ToggleFavoriteAsync(string userId, Guid listingId, CancellationToken token)
        {
            var listingExists = await _context.Listing.AnyAsync(l => l.Id == listingId, token);
            if (!listingExists)
                return ServiceResult<bool?>.Fail("Listing not found.", ResultStatus.NotFound);

            var existing = await _context.UserFavorites
                .FirstOrDefaultAsync(f => f.UserId == userId && f.ListingId == listingId, token);

            if (existing != null)
            {
                _context.UserFavorites.Remove(existing);
                _audit.Log("listing.unfavorited", userId, "Listing", listingId.ToString());
                await _context.SaveChangesAsync(token);
                return ServiceResult<bool?>.Ok(false);
            }

            await _context.UserFavorites.AddAsync(new UserFavorite
            {
                UserId = userId,
                ListingId = listingId,
                CreatedAt = DateTime.UtcNow,
            }, token);
            _audit.Log("listing.favorited", userId, "Listing", listingId.ToString());
            await _context.SaveChangesAsync(token);
            return ServiceResult<bool?>.Ok(true);
        }

        public async Task<ServiceResult<List<GetListingDto>?>> GetFavoritesAsync(string userId, CancellationToken token)
        {
            var listings = await _context.UserFavorites
                .AsNoTracking()
                .Where(f => f.UserId == userId)
                .Include(f => f.Listing).ThenInclude(l => l.Images)
                .Include(f => f.Listing).ThenInclude(l => l.Owner)
                .Select(f => f.Listing)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync(token);

            var ownerIds = listings.Select(l => l.OwnerId).Distinct().ToList();
            var ratingStats = await GetOwnerRatingStatsAsync(ownerIds, token);
            return ServiceResult<List<GetListingDto>?>.Ok(
                listings.Select(l =>
                {
                    ratingStats.TryGetValue(l.OwnerId, out var stats);
                    return new GetListingDto(l, true, stats.avg, stats.count);
                }).ToList());
        }

        public async Task<ServiceResult<GetListingDto?>> SetAvailabilityAsync(Guid id, string requesterId, bool isAvailable, CancellationToken token)
        {
            var listing = await _context.Listing.FindAsync([id], token);
            if (listing is null)
                return ServiceResult<GetListingDto?>.Fail("Listing not found.", ResultStatus.NotFound);
            if (listing.OwnerId != requesterId)
                return ServiceResult<GetListingDto?>.Fail("You do not own this listing.", ResultStatus.Forbidden);

            listing.IsAvailable = isAvailable;
            _audit.Log("listing.availability_changed", requesterId, "Listing", id.ToString(), $"isAvailable={isAvailable}");
            await _context.SaveChangesAsync(token);
            return ServiceResult<GetListingDto?>.Ok(new GetListingDto(listing));
        }

        private async Task<Dictionary<string, (double? avg, int count)>> GetOwnerRatingStatsAsync(List<string> ownerIds, CancellationToken token)
        {
            if (ownerIds.Count == 0) return new();
            var rows = await _context.Ratings
                .Where(r => ownerIds.Contains(r.RevieweeId))
                .GroupBy(r => r.RevieweeId)
                .Select(g => new { OwnerId = g.Key, Avg = (double?)g.Average(r => r.Stars), Count = g.Count() })
                .ToListAsync(token);
            return rows.ToDictionary(r => r.OwnerId, r => (r.Avg, r.Count));
        }

        private async Task<HashSet<Guid>?> GetFavoriteIdsAsync(string? userId, CancellationToken token)
        {
            if (userId == null) return null;
            var ids = await _context.UserFavorites
                .Where(f => f.UserId == userId)
                .Select(f => f.ListingId)
                .ToListAsync(token);
            return ids.ToHashSet();
        }

        private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLon = (lon2 - lon1) * Math.PI / 180;
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        }
    }
}
