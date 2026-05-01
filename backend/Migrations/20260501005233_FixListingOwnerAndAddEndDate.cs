using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class FixListingOwnerAndAddEndDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Listing_AspNetUsers_UserId",
                table: "Listing");

            migrationBuilder.DropIndex(
                name: "IX_Listing_UserId",
                table: "Listing");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Listing");

            migrationBuilder.AlterColumn<string>(
                name: "OwnerId",
                table: "Listing",
                type: "text",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<DateOnly>(
                name: "EndDate",
                table: "Listing",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.CreateIndex(
                name: "IX_Listing_OwnerId",
                table: "Listing",
                column: "OwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Listing_AspNetUsers_OwnerId",
                table: "Listing",
                column: "OwnerId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Listing_AspNetUsers_OwnerId",
                table: "Listing");

            migrationBuilder.DropIndex(
                name: "IX_Listing_OwnerId",
                table: "Listing");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "Listing");

            migrationBuilder.AlterColumn<Guid>(
                name: "OwnerId",
                table: "Listing",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "UserId",
                table: "Listing",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Listing_UserId",
                table: "Listing",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Listing_AspNetUsers_UserId",
                table: "Listing",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }
    }
}
