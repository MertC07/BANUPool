using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using BanuPool.Core.Entities;
using BanuPool.Core.Interfaces;
using BanuPool.Data;

namespace BanuPool.API.Services
{
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;

        public UserService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<BaseUser?> GetUserByIdAsync(int id)
        {
            return await _context.Users.FindAsync(id);
        }

        public async Task<Vehicle?> GetVehicleByUserIdAsync(int userId)
        {
            return await _context.Vehicles.FirstOrDefaultAsync(v => v.OwnerId == userId);
        }

        public async Task<BaseUser> UpdateUserAsync(BaseUser user, Vehicle? vehicleUpdate)
        {
            var existingUser = await _context.Users.FindAsync(user.Id);
            if (existingUser == null) return null;

            // Update User Fields
            existingUser.FirstName = user.FirstName;
            existingUser.LastName = user.LastName;
            existingUser.PhoneNumber = user.PhoneNumber;
            
            // Note: Email changes might require re-verification, skipping for MVP
            // Note: Password update should be separate service with hashing

            // Update Vehicle if provided
            if (vehicleUpdate != null)
            {
                var existingVehicle = await _context.Vehicles.FirstOrDefaultAsync(v => v.OwnerId == user.Id);
                if (existingVehicle != null)
                {
                    existingVehicle.PlateNumber = vehicleUpdate.PlateNumber;
                    existingVehicle.Model = vehicleUpdate.Model;
                    existingVehicle.Color = vehicleUpdate.Color;
                    _context.Entry(existingVehicle).State = EntityState.Modified;
                }
                else
                {
                    // Create new vehicle
                    var newVehicle = new Vehicle
                    {
                        OwnerId = user.Id,
                        PlateNumber = vehicleUpdate.PlateNumber,
                        Model = vehicleUpdate.Model,
                        Color = vehicleUpdate.Color
                    };
                    _context.Vehicles.Add(newVehicle);
                }
            }

            _context.Entry(existingUser).State = EntityState.Modified;
            await _context.SaveChangesAsync();

            return existingUser;
        }
    }
}
