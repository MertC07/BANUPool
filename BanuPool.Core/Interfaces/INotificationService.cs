using System.Collections.Generic;
using System.Threading.Tasks;
using BanuPool.Core.Entities;

namespace BanuPool.Core.Interfaces
{
    public interface INotificationService
    {
        Task CreateNotificationAsync(int userId, string title, string message, string type = "info", int? relatedRideId = null);
        Task<List<Notification>> GetUserNotificationsAsync(int userId);
        Task MarkAsReadAsync(int notificationId);
        Task DeleteNotificationAsync(int notificationId);
        Task DeleteAllNotificationsAsync(int userId);
        Task<int> GetUnreadCountAsync(int userId);
    }
}
