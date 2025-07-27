import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../hooks/useAuth';
import { ButtonSpinner } from '../../components/ui/LoadingSpinner';

// Validation schema
const registerSchema = Yup.object().shape({
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
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
  phone_number: Yup.string()
    .matches(/^\+?[\d\s-()]+$/, 'Invalid phone number format')
    .optional(),
  user_type: Yup.string()
    .oneOf(['individual', 'group_admin'], 'Invalid user type')
    .required('User type is required'),
});

function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values, { setSubmitting, setFieldError }) => {
    try {
      const { confirmPassword, ...userData } = values;
      const result = await register(userData);
      
      if (result.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setFieldError('email', result.message || 'Registration failed');
      }
    } catch (error) {
      setFieldError('email', 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
            <svg
              className="h-8 w-8 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        {/* Registration Form */}
        <Formik
          initialValues={{
            first_name: '',
            last_name: '',
            email: '',
            password: '',
            confirmPassword: '',
            phone_number: '',
            user_type: 'individual',
          }}
          validationSchema={registerSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting, errors, touched }) => (
            <Form className="mt-8 space-y-6">
              <div className="space-y-4">
                {/* Name Fields */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="first_name" className="form-label">
                      First Name
                    </label>
                    <Field
                      id="first_name"
                      name="first_name"
                      type="text"
                      autoComplete="given-name"
                      className={`input ${
                        errors.first_name && touched.first_name ? 'input-error' : ''
                      }`}
                      placeholder="First name"
                    />
                    <ErrorMessage
                      name="first_name"
                      component="div"
                      className="form-error"
                    />
                  </div>

                  <div>
                    <label htmlFor="last_name" className="form-label">
                      Last Name
                    </label>
                    <Field
                      id="last_name"
                      name="last_name"
                      type="text"
                      autoComplete="family-name"
                      className={`input ${
                        errors.last_name && touched.last_name ? 'input-error' : ''
                      }`}
                      placeholder="Last name"
                    />
                    <ErrorMessage
                      name="last_name"
                      component="div"
                      className="form-error"
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="form-label">
                    Email Address
                  </label>
                  <Field
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className={`input ${
                      errors.email && touched.email ? 'input-error' : ''
                    }`}
                    placeholder="Enter your email"
                  />
                  <ErrorMessage
                    name="email"
                    component="div"
                    className="form-error"
                  />
                </div>

                {/* Phone Number Field */}
                <div>
                  <label htmlFor="phone_number" className="form-label">
                    Phone Number (Optional)
                  </label>
                  <Field
                    id="phone_number"
                    name="phone_number"
                    type="tel"
                    autoComplete="tel"
                    className={`input ${
                      errors.phone_number && touched.phone_number ? 'input-error' : ''
                    }`}
                    placeholder="Enter your phone number"
                  />
                  <ErrorMessage
                    name="phone_number"
                    component="div"
                    className="form-error"
                  />
                </div>

                {/* User Type Field */}
                <div>
                  <label htmlFor="user_type" className="form-label">
                    Account Type
                  </label>
                  <Field
                    as="select"
                    id="user_type"
                    name="user_type"
                    className={`input ${
                      errors.user_type && touched.user_type ? 'input-error' : ''
                    }`}
                  >
                    <option value="individual">Individual User</option>
                    <option value="group_admin">Group Admin</option>
                  </Field>
                  <ErrorMessage
                    name="user_type"
                    component="div"
                    className="form-error"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Choose "Group Admin" if you want to create and manage groups
                  </p>
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <div className="relative">
                    <Field
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={`input pr-10 ${
                        errors.password && touched.password ? 'input-error' : ''
                      }`}
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <span className="text-xs text-gray-400">Hide</span>
                      ) : (
                        <span className="text-xs text-gray-400">Show</span>
                      )}
                    </button>
                  </div>
                  <ErrorMessage
                    name="password"
                    component="div"
                    className="form-error"
                  />
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Field
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={`input pr-10 ${
                        errors.confirmPassword && touched.confirmPassword ? 'input-error' : ''
                      }`}
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <span className="text-xs text-gray-400">Hide</span>
                      ) : (
                        <span className="text-xs text-gray-400">Show</span>
                      )}
                    </button>
                  </div>
                  <ErrorMessage
                    name="confirmPassword"
                    component="div"
                    className="form-error"
                  />
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="flex items-center">
                <input
                  id="agree-terms"
                  name="agree-terms"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  required
                />
                <label htmlFor="agree-terms" className="ml-2 block text-sm text-gray-900">
                  I agree to the{' '}
                  <a href="#" className="text-primary-600 hover:text-primary-500">
                    Terms and Conditions
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-primary-600 hover:text-primary-500">
                    Privacy Policy
                  </a>
                </label>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <ButtonSpinner />}
                  Create Account
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}

export default RegisterPage;