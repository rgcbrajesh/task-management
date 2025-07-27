import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { userService, notificationService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import LoadingSpinner, { ButtonSpinner } from '../../components/ui/LoadingSpinner';

// Validation schema for notification settings
const notificationSchema = Yup.object().shape({
  email_notifications: Yup.boolean(),
  whatsapp_notifications: Yup.boolean(),
  task_reminders: Yup.boolean(),
  task_assignments: Yup.boolean(),
  task_updates: Yup.boolean(),
  group_invitations: Yup.boolean(),
  daily_summary: Yup.boolean(),
  whatsapp_number: Yup.string()
    .matches(/^\+?[\d\s-()]+$/, 'Invalid phone number format')
    .when('whatsapp_notifications', {
      is: true,
      then: (schema) => schema.required('WhatsApp number is required when WhatsApp notifications are enabled'),
      otherwise: (schema) => schema.optional(),
    }),
});

function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('notifications');

  // Fetch notification settings
  const { data: notificationData, isLoading: notificationLoading, error: notificationError } = useQuery(
    'notification-settings',
    userService.getNotificationSettings
  );

  // Fetch notification preferences
  const { data: preferencesData, isLoading: preferencesLoading } = useQuery(
    'notification-preferences',
    notificationService.getPreferences
  );

  // Update notification settings mutation
  const updateNotificationMutation = useMutation(userService.updateNotificationSettings, {
    onSuccess: () => {
      toast.success('Notification settings updated successfully!');
      queryClient.invalidateQueries('notification-settings');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update notification settings';
      toast.error(message);
    },
  });

  // Update notification preferences mutation
  const updatePreferencesMutation = useMutation(notificationService.updatePreferences, {
    onSuccess: () => {
      toast.success('Notification preferences updated successfully!');
      queryClient.invalidateQueries('notification-preferences');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update preferences';
      toast.error(message);
    },
  });

  // Test notification mutation
  const testNotificationMutation = useMutation(notificationService.testNotification, {
    onSuccess: () => {
      toast.success('Test notification sent successfully!');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to send test notification';
      toast.error(message);
    },
  });

  const handleNotificationUpdate = async (values, { setSubmitting }) => {
    try {
      await updateNotificationMutation.mutateAsync(values);
    } catch (error) {
      console.error('Error updating notification settings:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreferencesUpdate = async (values, { setSubmitting }) => {
    try {
      await updatePreferencesMutation.mutateAsync(values);
    } catch (error) {
      console.error('Error updating preferences:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestNotification = (type) => {
    testNotificationMutation.mutate({ type });
  };

  const notificationSettings = notificationData?.data || {};
  const preferences = preferencesData?.data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your application preferences and notification settings
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'notifications'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'preferences'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Preferences
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'appearance'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Appearance
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Choose how you want to be notified about tasks and updates.
                </p>
              </div>

              {notificationLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : notificationError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-600">Failed to load notification settings</p>
                </div>
              ) : (
                <Formik
                  initialValues={{
                    email_notifications: notificationSettings.email_notifications ?? true,
                    whatsapp_notifications: notificationSettings.whatsapp_notifications ?? false,
                    task_reminders: notificationSettings.task_reminders ?? true,
                    task_assignments: notificationSettings.task_assignments ?? true,
                    task_updates: notificationSettings.task_updates ?? true,
                    group_invitations: notificationSettings.group_invitations ?? true,
                    daily_summary: notificationSettings.daily_summary ?? false,
                    whatsapp_number: notificationSettings.whatsapp_number || '',
                  }}
                  validationSchema={notificationSchema}
                  onSubmit={handleNotificationUpdate}
                  enableReinitialize
                >
                  {({ isSubmitting, values, errors, touched }) => (
                    <Form className="space-y-6">
                      {/* Notification Channels */}
                      <div>
                        <h3 className="text-base font-medium text-gray-900 mb-4">Notification Channels</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <label htmlFor="email_notifications" className="text-sm font-medium text-gray-700">
                                Email Notifications
                              </label>
                              <p className="text-sm text-gray-500">Receive notifications via email</p>
                            </div>
                            <Field
                              id="email_notifications"
                              name="email_notifications"
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <label htmlFor="whatsapp_notifications" className="text-sm font-medium text-gray-700">
                                WhatsApp Notifications
                              </label>
                              <p className="text-sm text-gray-500">Receive notifications via WhatsApp</p>
                            </div>
                            <Field
                              id="whatsapp_notifications"
                              name="whatsapp_notifications"
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                          </div>

                          {values.whatsapp_notifications && (
                            <div className="ml-4 mt-2">
                              <label htmlFor="whatsapp_number" className="block text-sm font-medium text-gray-700">
                                WhatsApp Number
                              </label>
                              <Field
                                id="whatsapp_number"
                                name="whatsapp_number"
                                type="tel"
                                className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                                  errors.whatsapp_number && touched.whatsapp_number ? 'border-red-300' : ''
                                }`}
                                placeholder="+1234567890"
                              />
                              <ErrorMessage name="whatsapp_number" component="div" className="mt-1 text-sm text-red-600" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notification Types */}
                      <div>
                        <h3 className="text-base font-medium text-gray-900 mb-4">Notification Types</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <label htmlFor="task_reminders" className="text-sm font-medium text-gray-700">
                                Task Reminders
                              </label>
                              <p className="text-sm text-gray-500">Get reminded about upcoming task deadlines</p>
                            </div>
                            <Field
                              id="task_reminders"
                              name="task_reminders"
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <label htmlFor="task_assignments" className="text-sm font-medium text-gray-700">
                                Task Assignments
                              </label>
                              <p className="text-sm text-gray-500">Get notified when tasks are assigned to you</p>
                            </div>
                            <Field
                              id="task_assignments"
                              name="task_assignments"
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <label htmlFor="task_updates" className="text-sm font-medium text-gray-700">
                                Task Updates
                              </label>
                              <p className="text-sm text-gray-500">Get notified about task status changes</p>
                            </div>
                            <Field
                              id="task_updates"
                              name="task_updates"
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                          </div>

                          {user?.user_type === 'group_admin' && (
                            <div className="flex items-center justify-between">
                              <div>
                                <label htmlFor="group_invitations" className="text-sm font-medium text-gray-700">
                                  Group Invitations
                                </label>
                                <p className="text-sm text-gray-500">Get notified about group membership changes</p>
                              </div>
                              <Field
                                id="group_invitations"
                                name="group_invitations"
                                type="checkbox"
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div>
                              <label htmlFor="daily_summary" className="text-sm font-medium text-gray-700">
                                Daily Summary
                              </label>
                              <p className="text-sm text-gray-500">Receive a daily summary of your tasks</p>
                            </div>
                            <Field
                              id="daily_summary"
                              name="daily_summary"
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Test Notifications */}
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-base font-medium text-gray-900 mb-4">Test Notifications</h3>
                        <div className="flex space-x-3">
                          <button
                            type="button"
                            onClick={() => handleTestNotification('email')}
                            disabled={testNotificationMutation.isLoading}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                          >
                            {testNotificationMutation.isLoading && <ButtonSpinner />}
                            Test Email
                          </button>
                          {values.whatsapp_notifications && values.whatsapp_number && (
                            <button
                              type="button"
                              onClick={() => handleTestNotification('whatsapp')}
                              disabled={testNotificationMutation.isLoading}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                              {testNotificationMutation.isLoading && <ButtonSpinner />}
                              Test WhatsApp
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmitting || updateNotificationMutation.isLoading}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                        >
                          {(isSubmitting || updateNotificationMutation.isLoading) && <ButtonSpinner />}
                          Save Settings
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              )}
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Application Preferences</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Customize your application experience and default settings.
                </p>
              </div>

              {preferencesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : (
                <Formik
                  initialValues={{
                    reminder_time: preferences.reminder_time || '09:00',
                    timezone: preferences.timezone || 'UTC',
                    date_format: preferences.date_format || 'MM/DD/YYYY',
                    time_format: preferences.time_format || '12',
                    default_task_priority: preferences.default_task_priority || 'medium',
                    auto_assign_tasks: preferences.auto_assign_tasks ?? false,
                  }}
                  onSubmit={handlePreferencesUpdate}
                  enableReinitialize
                >
                  {({ isSubmitting }) => (
                    <Form className="space-y-6">
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label htmlFor="reminder_time" className="block text-sm font-medium text-gray-700">
                            Daily Reminder Time
                          </label>
                          <Field
                            id="reminder_time"
                            name="reminder_time"
                            type="time"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                            Timezone
                          </label>
                          <Field
                            as="select"
                            id="timezone"
                            name="timezone"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          >
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">Eastern Time</option>
                            <option value="America/Chicago">Central Time</option>
                            <option value="America/Denver">Mountain Time</option>
                            <option value="America/Los_Angeles">Pacific Time</option>
                            <option value="Asia/Kolkata">India Standard Time</option>
                            <option value="Europe/London">London Time</option>
                          </Field>
                        </div>

                        <div>
                          <label htmlFor="date_format" className="block text-sm font-medium text-gray-700">
                            Date Format
                          </label>
                          <Field
                            as="select"
                            id="date_format"
                            name="date_format"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          >
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </Field>
                        </div>

                        <div>
                          <label htmlFor="time_format" className="block text-sm font-medium text-gray-700">
                            Time Format
                          </label>
                          <Field
                            as="select"
                            id="time_format"
                            name="time_format"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          >
                            <option value="12">12 Hour</option>
                            <option value="24">24 Hour</option>
                          </Field>
                        </div>

                        <div>
                          <label htmlFor="default_task_priority" className="block text-sm font-medium text-gray-700">
                            Default Task Priority
                          </label>
                          <Field
                            as="select"
                            id="default_task_priority"
                            name="default_task_priority"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </Field>
                        </div>
                      </div>

                      {user?.user_type === 'group_admin' && (
                        <div className="flex items-center justify-between">
                          <div>
                            <label htmlFor="auto_assign_tasks" className="text-sm font-medium text-gray-700">
                              Auto-assign Tasks
                            </label>
                            <p className="text-sm text-gray-500">Automatically assign new tasks to available group members</p>
                          </div>
                          <Field
                            id="auto_assign_tasks"
                            name="auto_assign_tasks"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmitting || updatePreferencesMutation.isLoading}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                        >
                          {(isSubmitting || updatePreferencesMutation.isLoading) && <ButtonSpinner />}
                          Save Preferences
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Appearance Settings</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Customize the look and feel of your application.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-medium text-gray-900">Theme</h3>
                    <p className="text-sm text-gray-500">Choose between light and dark mode</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      theme === 'dark' ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Current Theme: {theme === 'dark' ? 'Dark' : 'Light'}</h4>
                  <p className="text-sm text-gray-500">
                    {theme === 'dark' 
                      ? 'Dark mode reduces eye strain in low-light environments.' 
                      : 'Light mode provides a clean, bright interface.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;