using OpenSpot.Listings.DTOs;
using OpenSpot.Common;

namespace OpenSpot.Listings.Interfaces
{
    public interface IListingService
    {
        Task<ServiceResult<List<GetListingDto>?>> GetListingsAsync(string? requesterId, CancellationToken token);
        Task<ServiceResult<GetListingDto?>> GetListingByIdAsync(Guid id, string? requesterId, CancellationToken token);
        Task<ServiceResult<List<GetListingDto>?>> GetMyListingsAsync(string ownerId, CancellationToken token);
        Task<ServiceResult<GetListingDto?>> CreateNewListingAsync(string ownerId, CreateListingDto dto, CancellationToken token);
        Task<ServiceResult<GetListingDto?>> UpdateListingAsync(Guid id, string requesterId, UpdateListingDto dto, CancellationToken token);
        Task<ServiceResult<bool?>> DeleteListingAsync(Guid id, string requesterId, CancellationToken token);
        Task<ServiceResult<string?>> AddImageAsync(Guid listingId, string url, CancellationToken token);
        Task<ServiceResult<List<GetListingDto>?>> SearchListingsAsync(string? q, double? lat, double? lng, double radiusKm, string? requesterId, CancellationToken token);
        Task<ServiceResult<bool?>> ToggleFavoriteAsync(string userId, Guid listingId, CancellationToken token);
        Task<ServiceResult<List<GetListingDto>?>> GetFavoritesAsync(string userId, CancellationToken token);
    }
}
