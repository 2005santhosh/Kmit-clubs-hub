const { getRedisClient } = require('../config/redis');

class NotificationService {
  static async sendNotification(userId, notification) {
    try {
      const redis = getRedisClient();
      await redis.publish(`user-${userId}`, JSON.stringify(notification));
    } catch (error) {
      console.error('Notification send error:', error);
    }
  }

  static async sendBroadcast(channel, notification) {
    try {
      const redis = getRedisClient();
      await redis.publish(channel, JSON.stringify(notification));
    } catch (error) {
      console.error('Broadcast notification error:', error);
    }
  }

  static async getNotifications(userId) {
    try {
      const redis = getRedisClient();
      const notifications = await redis.get(`notifications-${userId}`);
      return notifications ? JSON.parse(notifications) : [];
    } catch (error) {
      console.error('Get notifications error:', error);
      return [];
    }
  }

  static async markAsRead(userId, notificationId) {
    try {
      const redis = getRedisClient();
      const notifications = await this.getNotifications(userId);
      const updatedNotifications = notifications.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      await redis.set(`notifications-${userId}`, JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Mark notification as read error:', error);
    }
  }
}

module.exports = NotificationService;