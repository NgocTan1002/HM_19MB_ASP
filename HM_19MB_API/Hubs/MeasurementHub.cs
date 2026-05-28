using Microsoft.AspNetCore.SignalR;

namespace HM_19MB_API.Hubs
{
    public class MeasurementHub : Hub
    {
        public  async Task JoinSesion(string sessionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"session_{sessionId}");
        }

        public async Task LeaveSession(string sessionId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session_{sessionId}");
        }
    }
}
