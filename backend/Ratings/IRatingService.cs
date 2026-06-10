using OpenSpot.Common;
using OpenSpot.Ratings.DTOs;

namespace OpenSpot.Ratings.Interfaces
{
    public interface IRatingService
    {
        Task<ServiceResult<GetRatingDto>> CreateRatingAsync(string reviewerId, CreateRatingDto dto, CancellationToken token);
        Task<ServiceResult<List<PendingRatingDto>>> GetPendingAsync(string userId, CancellationToken token);
        Task<ServiceResult<List<GetRatingDto>>> GetUserRatingsAsync(string userId, CancellationToken token);
    }
}
