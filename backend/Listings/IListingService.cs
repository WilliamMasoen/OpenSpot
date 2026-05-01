using OpenSpot.Listings.DTOs;
using OpenSpot.Common;

namespace OpenSpot.Listings.Interfaces
{
    public interface IListingService
    {
        Task<ServiceResult<List<GetListingDto>?>> GetListingsAsync(CancellationToken token);
        Task<ServiceResult<GetListingDto?>> GetListingByIdAsync(Guid id, CancellationToken token);
        Task<ServiceResult<GetListingDto?>> CreateNewListingAsync(string ownerId, CreateListingDto dto, CancellationToken token);
        Task<ServiceResult<GetListingDto?>> UpdateListingAsync(Guid id, string requesterId, UpdateListingDto dto, CancellationToken token);
        Task<ServiceResult<bool?>> DeleteListingAsync(Guid id, string requesterId, CancellationToken token);
    }
}
