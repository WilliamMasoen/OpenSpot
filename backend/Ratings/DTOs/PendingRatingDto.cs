namespace OpenSpot.Ratings.DTOs
{
    public class PendingRatingDto
    {
        public Guid SaleId { get; set; }
        public Guid ListingId { get; set; }
        public string ListingTitle { get; set; } = string.Empty;
        public string RevieweeId { get; set; } = string.Empty;
        public string RevieweeName { get; set; } = string.Empty;
        public string? RevieweeProfileImageUrl { get; set; }
    }
}
