using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using BanuPool.API.DTOs;
using BanuPool.Data;
using BanuPool.Core.Entities;

namespace BanuPool.API.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthService(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<BaseUser?> RegisterAsync(RegisterDto dto)
        {
            // Check if email exists
            if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            {
                return null; // Email taken
            }

            BaseUser newUser;
            if (dto.UserType == "Student")
            {
                newUser = new Student
                {
                    FirstName = dto.FirstName,
                    LastName = dto.LastName,
                    Email = dto.Email,
                    StudentId = dto.StudentId,
                    PhoneNumber = dto.PhoneNumber,
                    PasswordHash = HashPassword(dto.Password)
                };
            }
            else // Academician
            {
                newUser = new Academician
                {
                    FirstName = dto.FirstName,
                    LastName = dto.LastName,
                    Email = dto.Email,
                    Title = dto.AcademicianTitle,
                    PhoneNumber = dto.PhoneNumber,
                    PasswordHash = HashPassword(dto.Password)
                };
            }

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync(); // Save to generate Id

            if (dto.IsDriver && dto.Vehicle != null)
            {
                var vehicle = new Vehicle
                {
                    OwnerId = newUser.Id,
                    PlateNumber = dto.Vehicle.PlateNumber,
                    Model = dto.Vehicle.Model,
                    Color = dto.Vehicle.Color
                };
                _context.Vehicles.Add(vehicle);
                await _context.SaveChangesAsync();
            }

            return newUser;
        }

        public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null) return null;

            if (user.PasswordHash != HashPassword(dto.Password))
            {
                return null; // Invalid password
            }

            var token = GenerateJwtToken(user);
            return new AuthResponseDto
            {
                Token = token,
                UserId = user.Id,
                UserType = user is Student ? "Student" : "Academician",
                FullName = $"{user.FirstName} {user.LastName}"
            };
        }

        private string HashPassword(string password)
        {
            using (var sha256 = SHA256.Create())
            {
                var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
                return Convert.ToBase64String(bytes);
            }
        }

        private string GenerateJwtToken(BaseUser user)
        {
            var jwtSettings = _configuration.GetSection("JwtSettings");
            var key = Encoding.ASCII.GetBytes(jwtSettings["SecretKey"]);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("UserType", user is Student ? "Student" : "Academician")
            };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(double.Parse(jwtSettings["ExpiryInMinutes"])),
                Issuer = jwtSettings["Issuer"],
                Audience = jwtSettings["Audience"],
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}
