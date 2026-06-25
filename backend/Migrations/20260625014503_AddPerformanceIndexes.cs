using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Messages_IsRead",
                table: "Messages",
                column: "IsRead");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_SentAt",
                table: "Messages",
                column: "SentAt");

            migrationBuilder.CreateIndex(
                name: "IX_Listing_CreatedAt",
                table: "Listing",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Listing_IsAvailable",
                table: "Listing",
                column: "IsAvailable");

            migrationBuilder.CreateIndex(
                name: "IX_Listing_Price",
                table: "Listing",
                column: "Price");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_Messages_IsRead",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Messages_SentAt",
                table: "Messages");

            migrationBuilder.DropIndex(
                name: "IX_Listing_CreatedAt",
                table: "Listing");

            migrationBuilder.DropIndex(
                name: "IX_Listing_IsAvailable",
                table: "Listing");

            migrationBuilder.DropIndex(
                name: "IX_Listing_Price",
                table: "Listing");
        }
    }
}
