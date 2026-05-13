using Microsoft.EntityFrameworkCore;
using OpenSpot.Common;
using OpenSpot.Data;
using OpenSpot.Listings.DTOs;
using OpenSpot.Listings.Geocoding;
using OpenSpot.Listings.Interfaces;
using OpenSpot.Listings.Models;

namespace OpenSpot.Listings.Services
{
    public class ListingService : IListingService
    {
        private readonly ApplicationDbContext _context;
        private readonly IGeocodingService _geocoding;

        public ListingService(ApplicationDbContext context, IGeocodingService geocoding)
        {
            _context = context;
            _geocoding = geocoding;
        }

        public async Task<ServiceResult<List<GetListingDto>?>> GetListingsAsync(CancellationToken token)
        {
            var listings = await _context.Listing
                .Include(l => l.Images)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync(token);
            return ServiceResult<List<GetListingDto>?>.Ok(listings.Select(l => new GetListingDto(l)).ToList());
        }

        public async Task<ServiceResult<GetListingDto?>> GetListingByIdAsync(Guid id, CancellationToken token)
        {
            var listing = await _context.Listing
                .Include(l => l.Images)
                .FirstOrDefaultAsync(l => l.Id == id, token);
            if (listing is null)
                return ServiceResult<GetListingDto?>.Fail("Listing not found.", ResultStatus.NotFound);

            return ServiceResult<GetListingDto?>.Ok(new GetListingDto(listing));
        }

        public async Task<ServiceResult<List<GetListingDto>?>> GetMyListingsAsync(string ownerId, CancellationToken token)
        {
            var listings = await _context.Listing
                .Include(l => l.Images)
                .Where(l => l.OwnerId == ownerId)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync(token);
            return ServiceResult<List<GetListingDto>?>.Ok(listings.Select(l => new GetListingDto(l)).ToList());
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
            string? q, double? lat, double? lng, double radiusKm, CancellationToken token)
        {
            var query = _context.Listing.Include(l => l.Images).AsQueryable();

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

            return ServiceResult<List<GetListingDto>?>.Ok(listings.Select(l => new GetListingDto(l)).ToList());
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
