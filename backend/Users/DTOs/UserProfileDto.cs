using OpenSpot.Listings.DTOs;
using OpenSpot.Ratings.DTOs;

namespace OpenSpot.Users.DTOs
{
    public class UserProfileDto
    {
        public string Id { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? ProfileImageUrl { get; set; }
        public double? AverageRating { get; set; }
        public int TotalRatings { get; set; }
        public DateTime MemberSince { get; set; }
        public int ListingCount { get; set; }
        public List<GetRatingDto> RecentRatings { get; set; } = new();
        public List<GetListingDto> Listings { get; set; } = new();
    }
}
