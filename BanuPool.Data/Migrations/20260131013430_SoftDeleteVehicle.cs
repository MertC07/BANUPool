using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BanuPool.Data.Migrations
{
    /// <inheritdoc />
    public partial class SoftDeleteVehicle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Vehicles",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Vehicles");
        }
    }
}
