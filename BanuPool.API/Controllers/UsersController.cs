using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using BanuPool.API.DTOs;
using BanuPool.Core.Interfaces;
using BanuPool.Core.Entities;

namespace BanuPool.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly BanuPool.Data.AppDbContext _context; // Inject DbContext

        public UsersController(IUserService userService, BanuPool.Data.AppDbContext context)
        {
            _userService = userService;
            _context = context;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<UserProfileDto>> GetProfile(int id)
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null) return NotFound("Kullanıcı bulunamadı.");

            var vehicle = await _userService.GetVehicleByUserIdAsync(id);

            // Determine if Current User can message this Profile User
            bool canMessage = false;
            try
            {
                var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                               ?? User.FindFirst("UserId")?.Value;
                
                if (!string.IsNullOrEmpty(userIdStr) && int.TryParse(userIdStr, out int currentUserId))
                {
                    if (currentUserId != id) // Cannot message self
                    {
                        // Check if any reservation connects them (as Driver or Passenger)
                        canMessage = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.AnyAsync(
                            _context.Reservations.Include(r => r.Ride), 
                            r => (r.PassengerId == currentUserId && r.Ride.DriverId == id) || 
                                 (r.PassengerId == id && r.Ride.DriverId == currentUserId)
                        );
                    }
                }
            }
            catch { /* Ignore auth errors, default false */ }

            var dto = new UserProfileDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                UserType = user is Student ? "Öğrenci" : "Akademisyen",
                ReputationScore = user.ReputationScore,
                ProfilePhotoUrl = user.ProfilePhotoPath,
                CanMessage = canMessage, // Set permission
                Vehicle = vehicle != null ? new VehicleDto
                {
                    PlateNumber = vehicle.PlateNumber,
                    Model = vehicle.Model,
                    Color = vehicle.Color
                } : null
            };

            return Ok(dto);
        }


        [HttpPost("{id}/photo")]
        public async Task<IActionResult> UploadPhoto(int id, IFormFile file)
        {
            var user = await _userService.GetUserByIdAsync(id);
            if (user == null) return NotFound("Kullanıcı bulunamadı.");

            if (file == null || file.Length == 0)
                return BadRequest("Lütfen bir fotoğraf yükleyiniz.");

            // 1. Validate File Type (Basic)
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(ext))
                return BadRequest("Sadece JPG, PNG veya WEBP formatları desteklenir.");

            // 2. Prepare Directory
            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "profiles");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            // 3. Generate Filename (userid.ext)
            var fileName = $"{id}_{Guid.NewGuid()}{ext}"; // Unique name to prevent caching issues
            var filePath = Path.Combine(uploadsFolder, fileName);

            // 4. Save File
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // 5. Update User & Reputation
            // If first time uploading, give bonus
            bool isFirstTime = string.IsNullOrEmpty(user.ProfilePhotoPath);
            
            // Delete old photo if exists
            if (!string.IsNullOrEmpty(user.ProfilePhotoPath))
            {
                var oldPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", user.ProfilePhotoPath.TrimStart('/'));
                if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
            }

            user.ProfilePhotoPath = $"/uploads/profiles/{fileName}";
            
            if (isFirstTime)
            {
                user.ReputationScore = Math.Min(5.0, user.ReputationScore + 0.5); // Max 5.0 cap? User didn't specify, but let's cap at 5.0 or keep it open?
                // The request says "add trust score". Usually 5 is max. 
                // Let's assume 5 is NOT max strictly in this custom logic, or maybe it is. 
                // Let's increment but maybe cap at 5 if it was default. 
                // Actually, let's just add 0.5. If it goes above 5, so be it (super trusted).
                // Or standard logic: 5 is usually max. Let's cap at 5.0 for now to be safe, unless user requests otherwise.
                // Wait, if everyone starts at 5.0, then it should go UP? 
                // Ah, User said "Trust Score artırsın". If it starts at 5, maybe it can go to 5.5?
                // Let's allow it to go above 5.0 for "Verified" status.
                user.ReputationScore += 0.5;
            }

            // We need a way to save this via Service or Repo
            // Since Interface didn't have specific UpdatePhoto, we can use UpdateUserAsync hack or add new method.
            // But UpdateUserAsync takes "vehicleUpdate". 
            // Let's assume we can just save via context if we injected it, but we injected Service.
            // Does Service have a generic Update?
            // Service.UpdateUserAsync updates checks fields.
            // Let's modify Service to allow updating just the entity state if we pass it back?
            // Actually, we should probably add `UpdatePhotoAsync` to interface. 
            // For speed, let's cast _userService to concrete or adjust logic.
            // Better: Update `UpdateUserAsync` to handle this or just call context directly? No context here.
            
            // Quick fix: Add specific method to UserService and Interface.
            // OR reuse UpdateUserAsync but that overrides names.
            
            // Refactor Idea: Let's just update the user logic in service. 
            // I will update UserService first.
            
            // Wait, I can't call a method that doesn't exist yet. 
            // I will add `UpdateProfilePhotoAsync` to Service first.
            await _userService.UpdateProfilePhotoAsync(id, user.ProfilePhotoPath);

            return Ok(new { path = user.ProfilePhotoPath, newScore = user.ReputationScore });
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<UserProfileDto>> UpdateProfile(int id, UserProfileDto dto)
        {
            if (id != dto.Id) return BadRequest();

            var user = await _userService.GetUserByIdAsync(id);
            if (user == null) return NotFound();

            // Map DTO to Entity bits
            user.FirstName = dto.FirstName;
            user.LastName = dto.LastName;
            user.PhoneNumber = dto.PhoneNumber;
            
            Vehicle? vehicleUpdate = null;
            if (dto.Vehicle != null)
            {
                vehicleUpdate = new Vehicle
                {
                    PlateNumber = dto.Vehicle.PlateNumber,
                    Model = dto.Vehicle.Model,
                    Color = dto.Vehicle.Color
                };
            }

            await _userService.UpdateUserAsync(user, vehicleUpdate);

            return Ok(dto);
        }
    }
}
