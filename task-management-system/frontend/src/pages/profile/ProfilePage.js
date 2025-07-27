import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { userService, authService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner, { ButtonSpinner } from '../../components/ui/LoadingSpinner';

// Validation schema for profile update
const profileSchema = Yup.object().shape({
  first_name: Yup.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .required('First name is required'),
  last_name: Yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .required('Last name is required'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  phone_number: Yup.string()
    .matches(/^\+?[\d\s-()]+$/, 'Invalid phone number format')
    .optional(),
});

// Validation schema for password change
const passwordSchema = Yup.object().shape({
  current_password: Yup.string()
    .required('Current password is required'),
  new_password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .required('New password is required'),
  confirm_password: Yup.string()
    .oneOf([Yup.ref('new_password'), null], 'Passwords must match')
    .required('Please confirm your password'),
});

function ProfilePage() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Fetch user profile
  const { data: profileData, isLoading, error } = useQuery(
    'user-profile',
    userService.getProfile,
    {
      initialData: { data: user },
    }
  );

  // Update profile mutation
  const updateProfileMutation = useMutation(userService.updateProfile, {
    onSuccess: (response) => {
      toast.success('Profile updated successfully!');
      updateUser(response.data);
      queryClient.invalidateQueries('user-profile');
      queryClient.invalidateQueries('dashboard');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation(authService.changePassword, {
    onSuccess: () => {
      toast.success('Password changed successfully!');
      setShowPasswordForm(false);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to change password';
      toast.error(message);
    },
  });

  const handleProfileUpdate = async (values, { setSubmitting }) => {
    try {
      await updateProfileMutation.mutateAsync(values);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async (values, { setSubmitting, resetForm }) => {
    try {
      const { confirm_password, ...passwordData } = values;
      await changePasswordMutation.mutateAsync(passwordData);
      resetForm();
    } catch (error) {
      console.error('Error changing password:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading profile</h3>
        <p className="mt-1 text-sm text-gray-500">Unable to load profile data. Please try again.</p>
      </div>
    );
  }

  const profile = profileData?.data || user;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0 h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-xl font-medium text-primary-600">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {profile?.first_name} {profile?.last_name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{profile?.email}</p>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                profile?.user_type === 'group_admin' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {profile?.user_type === 'group_admin' ? 'Group Admin' : 'Individual User'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Profile Information
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'security'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Security
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Update your personal information and contact details.
                </p>
              </div>

              <Formik
                initialValues={{
                  first_name: profile?.first_name || '',
                  last_name: profile?.last_name || '',
                  email: profile?.email || '',
                  phone_number: profile?.phone_number || '',
                }}
                validationSchema={profileSchema}
                onSubmit={handleProfileUpdate}
                enableReinitialize
              >
                {({ isSubmitting, errors, touched }) => (
                  <Form className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                          First Name *
                        </label>
                        <Field
                          id="first_name"
                          name="first_name"
                          type="text"
                           style={{ color:"black" }}
                          className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                            errors.first_name && touched.first_name ? 'border-red-300' : ''
                          }`}
                        />
                        <ErrorMessage name="first_name" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div>
                        <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                          Last Name *
                        </label>
                        <Field
                          id="last_name"
                          name="last_name"
                          type="text"
                          style={{ color:"black" }}
                          className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                            errors.last_name && touched.last_name ? 'border-red-300' : ''
                          }`}
                        />
                        <ErrorMessage name="last_name" component="div" className="mt-1 text-sm text-red-600" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address *
                      </label>
                      <Field
                        id="email"
                        name="email"
                        type="email"
                         style={{ color:"black" }}
                        className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                          errors.email && touched.email ? 'border-red-300' : ''
                        }`}
                      />
                      <ErrorMessage name="email" component="div" className="mt-1 text-sm text-red-600" />
                    </div>

                    <div>
                      <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                        Phone Number
                      </label>
                      <Field
                        id="phone_number"
                        name="phone_number"
                        type="tel"
                         style={{ color:"black" }}
                        className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                          errors.phone_number && touched.phone_number ? 'border-red-300' : ''
                        }`}
                        placeholder="Enter your phone number"
                      />
                      <ErrorMessage name="phone_number" component="div" className="mt-1 text-sm text-red-600" />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting || updateProfileMutation.isLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {(isSubmitting || updateProfileMutation.isLoading) && <ButtonSpinner />}
                        Save Changes
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>

              {/* Account Information */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Account Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {profile?.user_type === 'group_admin' ? 'Group Administrator' : 'Individual User'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Member Since</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {profile?.last_login ? new Date(profile.last_login).toLocaleString() : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Profile Updated</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Manage your account security and password settings.
                </p>
              </div>

              {/* Password Section */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-medium text-gray-900">Password</h3>
                    <p className="text-sm text-gray-500">
                      Change your password to keep your account secure
                    </p>
                  </div>
                  {!showPasswordForm && (
                    <button
                      onClick={() => setShowPasswordForm(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
                    >
                      Change Password
                    </button>
                  )}
                </div>

                {showPasswordForm && (
                  <Formik
                    initialValues={{
                      current_password: '',
                      new_password: '',
                      confirm_password: '',
                    }}
                    validationSchema={passwordSchema}
                    onSubmit={handlePasswordChange}
                  >
                    {({ isSubmitting, errors, touched }) => (
                      <Form className="space-y-4">
                        <div>
                          <label htmlFor="current_password" className="block text-sm font-medium text-gray-700">
                            Current Password *
                          </label>
                          <Field
                            id="current_password"
                            name="current_password"
                            type="password"
                            className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                              errors.current_password && touched.current_password ? 'border-red-300' : ''
                            }`}
                          />
                          <ErrorMessage name="current_password" component="div" className="mt-1 text-sm text-red-600" />
                        </div>

                        <div>
                          <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">
                            New Password *
                          </label>
                          <Field
                            id="new_password"
                            name="new_password"
                            type="password"
                            className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                              errors.new_password && touched.new_password ? 'border-red-300' : ''
                            }`}
                          />
                          <ErrorMessage name="new_password" component="div" className="mt-1 text-sm text-red-600" />
                        </div>

                        <div>
                          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                            Confirm New Password *
                          </label>
                          <Field
                            id="confirm_password"
                            name="confirm_password"
                            type="password"
                            className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                              errors.confirm_password && touched.confirm_password ? 'border-red-300' : ''
                            }`}
                          />
                          <ErrorMessage name="confirm_password" component="div" className="mt-1 text-sm text-red-600" />
                        </div>

                        <div className="flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => setShowPasswordForm(false)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting || changePasswordMutation.isLoading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                          >
                            {(isSubmitting || changePasswordMutation.isLoading) && <ButtonSpinner />}
                            Update Password
                          </button>
                        </div>
                      </Form>
                    )}
                  </Formik>
                )}
              </div>

              {/* Security Information */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Security Tips
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Use a strong password with at least 8 characters</li>
                        <li>Include uppercase, lowercase, numbers, and special characters</li>
                        <li>Don't reuse passwords from other accounts</li>
                        <li>Change your password regularly</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;