using System.ComponentModel.DataAnnotations;

namespace BanuPool.API.DTOs
{
    public class RegisterDto
    {
        [Required]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string Password { get; set; } = string.Empty;
        
        [Required]
        public string FirstName { get; set; } = string.Empty;
        
        [Required]
        public string LastName { get; set; } = string.Empty;
        
        // "Student" or "Academician"
        [Required]
        public string UserType { get; set; } = "Student"; 

        // Specific fields
        public string StudentId { get; set; } = string.Empty;
        public string AcademicianTitle { get; set; } = string.Empty;

        [Required]
        public string PhoneNumber { get; set; } = string.Empty;

        public bool IsDriver { get; set; }
        public VehicleDto? Vehicle { get; set; }
    }

    public class LoginDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string UserType { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
    }
}
