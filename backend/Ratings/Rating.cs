using System.ComponentModel.DataAnnotations.Schema;
using OpenSpot.Sales.Models;
using OpenSpot.Users.Models;

namespace OpenSpot.Ratings.Models
{
    public class Rating
    {
        public Guid Id { get; set; }

        public Guid SaleId { get; set; }

        [ForeignKey("SaleId")]
        public Sale Sale { get; set; } = null!;

        public string ReviewerId { get; set; } = string.Empty;

        [ForeignKey("ReviewerId")]
        public User Reviewer { get; set; } = null!;

        public string RevieweeId { get; set; } = string.Empty;

        [ForeignKey("RevieweeId")]
        public User Reviewee { get; set; } = null!;

        public int Stars { get; set; }

        public string? Comment { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}
