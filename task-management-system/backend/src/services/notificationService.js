// const cron = require('node-cron');
// const twilio = require('twilio');
// const { getConnection } = require('../config/database');

// // Initialize Twilio client
// let twilioClient = null;
// if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
//   twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// }

// // Notification service class
// class NotificationService {
//   constructor() {
//     this.isRunning = false;
//   }

//   // Start the notification scheduler
//   startScheduler() {
//     if (this.isRunning) {
//       console.log('Notification scheduler is already running');
//       return;
//     }

//     // Run every hour to check for tasks that need notifications
//     this.scheduledTask = cron.schedule('0 * * * *', async () => {
//       console.log('Running hourly notification check...');
//       await this.processHourlyNotifications();
//     }, {
//       scheduled: false,
//       timezone: 'UTC'
//     });

//     // Also run every 15 minutes for more frequent checks
//     this.frequentTask = cron.schedule('*/15 * * * *', async () => {
//       console.log('Running frequent notification check...');
//       await this.processFrequentNotifications();
//     }, {
//       scheduled: false,
//       timezone: 'UTC'
//     });

//     this.scheduledTask.start();
//     this.frequentTask.start();
//     this.isRunning = true;
//     console.log('✅ Notification scheduler started');
//   }

//   // Stop the notification scheduler
//   stopScheduler() {
//     if (this.scheduledTask) {
//       this.scheduledTask.stop();
//     }
//     if (this.frequentTask) {
//       this.frequentTask.stop();
//     }
//     this.isRunning = false;
//     console.log('Notification scheduler stopped');
//   }

//   // Process hourly notifications for incomplete tasks
//   async processHourlyNotifications() {
//     try {
//       const db = getConnection();
      
//       // Get tasks that are currently active and incomplete
//       const [tasks] = await db.execute(`
//         SELECT t.id, t.title, t.start_time, t.end_time, t.status, t.assigned_to,
//                u.first_name, u.last_name, u.email, u.phone_number,
//                us.notification_whatsapp, us.notification_email, us.notification_frequency
//         FROM tasks t
//         JOIN users u ON t.assigned_to = u.id
//         LEFT JOIN user_settings us ON u.id = us.user_id
//         WHERE t.is_active = true 
//           AND t.status IN ('pending', 'in_progress')
//           AND t.start_time <= NOW()
//           AND t.end_time > NOW()
//           AND u.is_active = true
//       `);

//       for (const task of tasks) {
//         await this.checkAndSendTaskReminder(task);
//       }

//       // Also check for overdue tasks
//       await this.processOverdueTasks();
      
//     } catch (error) {
//       console.error('Error processing hourly notifications:', error);
//     }
//   }

//   // Process frequent notifications (every 15 minutes)
//   async processFrequentNotifications() {
//     try {
//       const db = getConnection();
      
//       // Get tasks starting in the next 30 minutes
//       const [upcomingTasks] = await db.execute(`
//         SELECT t.id, t.title, t.start_time, t.end_time, t.status, t.assigned_to,
//                u.first_name, u.last_name, u.email, u.phone_number,
//                us.notification_whatsapp, us.notification_email
//         FROM tasks t
//         JOIN users u ON t.assigned_to = u.id
//         LEFT JOIN user_settings us ON u.id = us.user_id
//         WHERE t.is_active = true 
//           AND t.status = 'pending'
//           AND t.start_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 MINUTE)
//           AND u.is_active = true
//       `);

//       for (const task of upcomingTasks) {
//         await this.sendUpcomingTaskNotification(task);
//       }
      
//     } catch (error) {
//       console.error('Error processing frequent notifications:', error);
//     }
//   }

//   // Check and send task reminder if needed
//   async checkAndSendTaskReminder(task) {
//     try {
//       const db = getConnection();
      
//       // Check if we've already sent a notification for this task in the last hour
//       const [recentNotifications] = await db.execute(`
//         SELECT id FROM notification_logs 
//         WHERE task_id = ? AND user_id = ? 
//           AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
//           AND status IN ('sent', 'delivered')
//       `, [task.id, task.assigned_to]);

//       if (recentNotifications.length > 0) {
//         return; // Already sent notification recently
//       }

//       const timeRemaining = this.calculateTimeRemaining(task.end_time);
//       const message = this.generateTaskReminderMessage(task, timeRemaining);

//       // Send WhatsApp notification if enabled
//       if (task.notification_whatsapp && task.phone_number) {
//         await this.sendWhatsAppNotification(task, message);
//       }

//       // Send email notification if enabled
//       if (task.notification_email && task.email) {
//         await this.sendEmailNotification(task, message);
//       }

//     } catch (error) {
//       console.error(`Error sending reminder for task ${task.id}:`, error);
//     }
//   }

//   // Send notification for upcoming tasks
//   async sendUpcomingTaskNotification(task) {
//     try {
//       const db = getConnection();
      
//       // Check if we've already sent an upcoming notification for this task
//       const [existingNotifications] = await db.execute(`
//         SELECT id FROM notification_logs 
//         WHERE task_id = ? AND user_id = ? 
//           AND message LIKE '%starting soon%'
//           AND status IN ('sent', 'delivered')
//       `, [task.id, task.assigned_to]);

//       if (existingNotifications.length > 0) {
//         return; // Already sent upcoming notification
//       }

//       const timeUntilStart = this.calculateTimeUntilStart(task.start_time);
//       const message = this.generateUpcomingTaskMessage(task, timeUntilStart);

//       // Send WhatsApp notification if enabled
//       if (task.notification_whatsapp && task.phone_number) {
//         await this.sendWhatsAppNotification(task, message);
//       }

//       // Send email notification if enabled
//       if (task.notification_email && task.email) {
//         await this.sendEmailNotification(task, message);
//       }

//     } catch (error) {
//       console.error(`Error sending upcoming notification for task ${task.id}:`, error);
//     }
//   }

//   // Process overdue tasks
//   async processOverdueTasks() {
//     try {
//       const db = getConnection();
      
//       // Update overdue tasks
//       await db.execute(`
//         UPDATE tasks 
//         SET status = 'overdue', updated_at = CURRENT_TIMESTAMP 
//         WHERE is_active = true 
//           AND status IN ('pending', 'in_progress')
//           AND end_time < NOW()
//       `);

//       // Get newly overdue tasks for notifications
//       const [overdueTasks] = await db.execute(`
//         SELECT t.id, t.title, t.start_time, t.end_time, t.status, t.assigned_to,
//                u.first_name, u.last_name, u.email, u.phone_number,
//                us.notification_whatsapp, us.notification_email
//         FROM tasks t
//         JOIN users u ON t.assigned_to = u.id
//         LEFT JOIN user_settings us ON u.id = us.user_id
//         WHERE t.is_active = true 
//           AND t.status = 'overdue'
//           AND t.end_time BETWEEN DATE_SUB(NOW(), INTERVAL 1 HOUR) AND NOW()
//           AND u.is_active = true
//       `);

//       for (const task of overdueTasks) {
//         const message = this.generateOverdueTaskMessage(task);
        
//         // Send WhatsApp notification if enabled
//         if (task.notification_whatsapp && task.phone_number) {
//           await this.sendWhatsAppNotification(task, message);
//         }

//         // Send email notification if enabled
//         if (task.notification_email && task.email) {
//           await this.sendEmailNotification(task, message);
//         }
//       }

//     } catch (error) {
//       console.error('Error processing overdue tasks:', error);
//     }
//   }

//   // Send WhatsApp notification using Twilio
//   async sendWhatsAppNotification(task, message) {
//     try {
//       if (!twilioClient) {
//         throw new Error('Twilio client not initialized');
//       }

//       const db = getConnection();
      
//       // Create notification log entry
//       const [logResult] = await db.execute(`
//         INSERT INTO notification_logs (task_id, user_id, notification_type, message, status)
//         VALUES (?, ?, 'whatsapp', ?, 'pending')
//       `, [task.id, task.assigned_to, message]);

//       const notificationId = logResult.insertId;

//       // Format phone number for WhatsApp
//       const whatsappNumber = `whatsapp:${task.phone_number}`;
//       const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

//       // Send WhatsApp message
//       const twilioMessage = await twilioClient.messages.create({
//         body: message,
//         from: fromNumber,
//         to: whatsappNumber
//       });

//       // Update notification log with success
//       await db.execute(`
//         UPDATE notification_logs 
//         SET status = 'sent', sent_at = CURRENT_TIMESTAMP 
//         WHERE id = ?
//       `, [notificationId]);

//       console.log(`WhatsApp notification sent for task ${task.id}, Twilio SID: ${twilioMessage.sid}`);

//     } catch (error) {
//       console.error(`Error sending WhatsApp notification for task ${task.id}:`, error);
      
//       // Update notification log with failure
//       const db = getConnection();
//       await db.execute(`
//         UPDATE notification_logs 
//         SET status = 'failed', error_message = ? 
//         WHERE task_id = ? AND user_id = ? AND notification_type = 'whatsapp' 
//         ORDER BY created_at DESC LIMIT 1
//       `, [error.message, task.id, task.assigned_to]);
//     }
//   }

//   // Send email notification (placeholder - integrate with email service)
//   async sendEmailNotification(task, message) {
//     try {
//       const db = getConnection();
      
//       // Create notification log entry
//       const [logResult] = await db.execute(`
//         INSERT INTO notification_logs (task_id, user_id, notification_type, message, status)
//         VALUES (?, ?, 'email', ?, 'pending')
//       `, [task.id, task.assigned_to, message]);

//       const notificationId = logResult.insertId;

//       // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
//       // For now, we'll simulate email sending
//       console.log(`Email notification would be sent to ${task.email}: ${message}`);

//       // Update notification log with success
//       await db.execute(`
//         UPDATE notification_logs 
//         SET status = 'sent', sent_at = CURRENT_TIMESTAMP 
//         WHERE id = ?
//       `, [notificationId]);

//     } catch (error) {
//       console.error(`Error sending email notification for task ${task.id}:`, error);
      
//       // Update notification log with failure
//       const db = getConnection();
//       await db.execute(`
//         UPDATE notification_logs 
//         SET status = 'failed', error_message = ? 
//         WHERE task_id = ? AND user_id = ? AND notification_type = 'email' 
//         ORDER BY created_at DESC LIMIT 1
//       `, [error.message, task.id, task.assigned_to]);
//     }
//   }

//   // Generate task reminder message
//   generateTaskReminderMessage(task, timeRemaining) {
//     const taskTitle = task.title;
//     const userName = task.first_name;
    
//     if (timeRemaining.hours > 0) {
//       return `Hi ${userName}! 📋 Task "${taskTitle}" is still incomplete. You have ${timeRemaining.hours}h ${timeRemaining.minutes}m remaining. Keep going! 💪`;
//     } else {
//       return `Hi ${userName}! ⏰ Task "${taskTitle}" is due in ${timeRemaining.minutes} minutes. Please complete it soon!`;
//     }
//   }

//   // Generate upcoming task message
//   generateUpcomingTaskMessage(task, timeUntilStart) {
//     const taskTitle = task.title;
//     const userName = task.first_name;
    
//     return `Hi ${userName}! 🔔 Task "${taskTitle}" is starting soon (in ${timeUntilStart.minutes} minutes). Get ready! 🚀`;
//   }

//   // Generate overdue task message
//   generateOverdueTaskMessage(task) {
//     const taskTitle = task.title;
//     const userName = task.first_name;
    
//     return `Hi ${userName}! 🚨 Task "${taskTitle}" is now overdue. Please complete it as soon as possible.`;
//   }

//   // Calculate time remaining until task end
//   calculateTimeRemaining(endTime) {
//     const now = new Date();
//     const end = new Date(endTime);
//     const diffMs = end.getTime() - now.getTime();
    
//     const hours = Math.floor(diffMs / (1000 * 60 * 60));
//     const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
//     return { hours: Math.max(0, hours), minutes: Math.max(0, minutes) };
//   }

//   // Calculate time until task start
//   calculateTimeUntilStart(startTime) {
//     const now = new Date();
//     const start = new Date(startTime);
//     const diffMs = start.getTime() - now.getTime();
    
//     const hours = Math.floor(diffMs / (1000 * 60 * 60));
//     const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
//     return { hours: Math.max(0, hours), minutes: Math.max(0, minutes) };
//   }
// }

// // Create singleton instance
// const notificationService = new NotificationService();

// // Export functions for use in server
// const startNotificationScheduler = () => {
//   notificationService.startScheduler();
// };

// const stopNotificationScheduler = () => {
//   notificationService.stopScheduler();
// };

// module.exports = {
//   startNotificationScheduler,
//   stopNotificationScheduler,
//   notificationService,
// };
let client = null;

// Only initialize Twilio if SID is valid
if (
  process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') &&
  process.env.TWILIO_AUTH_TOKEN
) {
  const twilio = require('twilio');
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log("✅ Twilio client initialized");
} else {
  console.warn("⚠️ Twilio credentials missing or invalid. Using dummy notification sender.");
}
const startNotificationScheduler = () => {
  console.log("⏰ Dummy scheduler started");
  // Put dummy interval here if needed
};

// Safe wrapper function
const sendWhatsAppNotification = async (to, message) => {
  if (!client) {
    console.log(`🟡 Dummy WhatsApp Notification: "${message}" → ${to}`);
    return;
  }

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
    });
    console.log("✅ WhatsApp message sent");
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error.message);
  }
};

module.exports = {
  sendWhatsAppNotification,
  startNotificationScheduler
};
