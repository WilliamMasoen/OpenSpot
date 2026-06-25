using Microsoft.EntityFrameworkCore;
using OpenSpot.Common;
using OpenSpot.Data;
using OpenSpot.Ratings.DTOs;
using OpenSpot.Ratings.Interfaces;
using OpenSpot.Ratings.Models;

namespace OpenSpot.Ratings.Services
{
    public class RatingService : IRatingService
    {
        private readonly ApplicationDbContext _db;

        public RatingService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<ServiceResult<GetRatingDto>> CreateRatingAsync(string reviewerId, CreateRatingDto dto, CancellationToken token)
        {
            var sale = await _db.Sales
                .AsNoTracking()
                .Include(s => s.Listing)
                .FirstOrDefaultAsync(s => s.Id == dto.SaleId, token);

            if (sale is null)
                return ServiceResult<GetRatingDto>.Fail("Sale not found.", ResultStatus.NotFound);

            if (sale.SellerId != reviewerId && sale.BuyerId != reviewerId)
                return ServiceResult<GetRatingDto>.Fail("You were not part of this sale.", ResultStatus.Forbidden);

            var revieweeId = sale.SellerId == reviewerId ? sale.BuyerId : sale.SellerId;

            var alreadyRated = await _db.Ratings
                .AnyAsync(r => r.SaleId == dto.SaleId && r.ReviewerId == reviewerId, token);
            if (alreadyRated)
                return ServiceResult<GetRatingDto>.Fail("You have already rated this sale.", ResultStatus.Conflict);

            var reviewer = await _db.Users.FindAsync(new object[] { reviewerId }, token);

            var rating = new Rating
            {
                Id = Guid.NewGuid(),
                SaleId = dto.SaleId,
                ReviewerId = reviewerId,
                RevieweeId = revieweeId,
                Stars = dto.Stars,
                Comment = dto.Comment,
                CreatedAt = DateTime.UtcNow,
            };

            _db.Ratings.Add(rating);
            await _db.SaveChangesAsync(token);

            return ServiceResult<GetRatingDto>.Created(new GetRatingDto
            {
                Id = rating.Id,
                SaleId = rating.SaleId,
                ReviewerId = reviewerId,
                ReviewerName = reviewer is not null ? $"{reviewer.FirstName} {reviewer.LastName}".Trim() : string.Empty,
                ReviewerProfileImageUrl = reviewer?.ProfileImageUrl,
                Stars = rating.Stars,
                Comment = rating.Comment,
                CreatedAt = rating.CreatedAt,
            });
        }

        public async Task<ServiceResult<List<PendingRatingDto>>> GetPendingAsync(string userId, CancellationToken token)
        {
            var pending = await _db.Sales
                .AsNoTracking()
                .Include(s => s.Listing)
                .Include(s => s.Seller)
                .Include(s => s.Buyer)
                .Where(s => (s.SellerId == userId || s.BuyerId == userId) &&
                            !_db.Ratings.Any(r => r.SaleId == s.Id && r.ReviewerId == userId))
                .ToListAsync(token);

            var dtos = pending.Select(s =>
            {
                var reviewee = s.SellerId == userId ? s.Buyer : s.Seller;
                return new PendingRatingDto
                {
                    SaleId = s.Id,
                    ListingId = s.ListingId,
                    ListingTitle = s.Listing.Title,
                    RevieweeId = reviewee.Id,
                    RevieweeName = $"{reviewee.FirstName} {reviewee.LastName}".Trim(),
                    RevieweeProfileImageUrl = reviewee.ProfileImageUrl,
                };
            }).ToList();

            return ServiceResult<List<PendingRatingDto>>.Ok(dtos);
        }

        public async Task<ServiceResult<List<GetRatingDto>>> GetUserRatingsAsync(string userId, CancellationToken token)
        {
            var ratings = await _db.Ratings
                .AsNoTracking()
                .Include(r => r.Reviewer)
                .Where(r => r.RevieweeId == userId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync(token);

            var dtos = ratings.Select(r => new GetRatingDto
            {
                Id = r.Id,
                SaleId = r.SaleId,
                ReviewerId = r.ReviewerId,
                ReviewerName = $"{r.Reviewer.FirstName} {r.Reviewer.LastName}".Trim(),
                ReviewerProfileImageUrl = r.Reviewer.ProfileImageUrl,
                Stars = r.Stars,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt,
            }).ToList();

            return ServiceResult<List<GetRatingDto>>.Ok(dtos);
        }
    }
}
