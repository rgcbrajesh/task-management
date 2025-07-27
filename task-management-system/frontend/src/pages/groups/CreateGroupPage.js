import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage, FieldArray } from 'formik';
import * as Yup from 'yup';
import { useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { groupService, userService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner, { ButtonSpinner } from '../../components/ui/LoadingSpinner';

// Validation schema
const groupSchema = Yup.object().shape({
  name: Yup.string()
    .min(3, 'Group name must be at least 3 characters')
    .max(100, 'Group name must be less than 100 characters')
    .required('Group name is required'),
  description: Yup.string()
    .max(500, 'Description must be less than 500 characters'),
  members: Yup.array().of(
    Yup.object().shape({
      email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
    })
  ),
});

function CreateGroupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Create group mutation
  const createGroupMutation = useMutation(groupService.createGroup, {
    onSuccess: (response) => {
      toast.success('Group created successfully!');
      queryClient.invalidateQueries('groups');
      queryClient.invalidateQueries('dashboard');
      navigate('/groups');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to create group';
      toast.error(message);
    },
  });

  // Search users function
  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await userService.searchUsers(query, 10);
      setSearchResults(response.data?.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      // Filter out empty member entries
      const validMembers = values.members.filter(member => member.email.trim());
      
      const groupData = {
        name: values.name,
        description: values.description,
        members: validMembers,
      };

      await createGroupMutation.mutateAsync(groupData);
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // If user is not group admin, show access denied
  if (user?.user_type !== 'group_admin') {
    return (
      <div className="text-center py-12">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
          <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">
          Only group administrators can create groups.
        </p>
        <div className="mt-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Group</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create a new group and invite team members to collaborate
            </p>
          </div>
          <button
            onClick={() => navigate('/groups')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Groups
          </button>
        </div>
      </div>

      {/* Group Creation Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <Formik
          initialValues={{
            name: '',
            description: '',
            members: [{ email: '' }],
          }}
          validationSchema={groupSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting, errors, touched, values, setFieldValue }) => (
            <Form className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Group Name *
                  </label>
                  <Field
                    id="name"
                    name="name"
                    type="text"
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      errors.name && touched.name ? 'border-red-300' : ''
                    }`}
                    placeholder="Enter group name"
                  />
                  <ErrorMessage name="name" component="div" className="mt-1 text-sm text-red-600" />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <Field
                    as="textarea"
                    id="description"
                    name="description"
                    rows={4}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      errors.description && touched.description ? 'border-red-300' : ''
                    }`}
                    placeholder="Enter group description (optional)"
                  />
                  <ErrorMessage name="description" component="div" className="mt-1 text-sm text-red-600" />
                </div>
              </div>

              {/* Members Section */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Group Members</h3>
                  <p className="text-sm text-gray-500">Add team members by email address</p>
                </div>

                <FieldArray name="members">
                  {({ push, remove }) => (
                    <div className="space-y-4">
                      {values.members.map((member, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="flex-1">
                            <label htmlFor={`members.${index}.email`} className="sr-only">
                              Member email
                            </label>
                            <Field
                              id={`members.${index}.email`}
                              name={`members.${index}.email`}
                              type="email"
                              className={`block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                                errors.members?.[index]?.email && touched.members?.[index]?.email ? 'border-red-300' : ''
                              }`}
                              placeholder="Enter member email address"
                              onChange={(e) => {
                                setFieldValue(`members.${index}.email`, e.target.value);
                                // Trigger search when typing
                                if (e.target.value.length >= 2) {
                                  searchUsers(e.target.value);
                                }
                              }}
                            />
                            <ErrorMessage 
                              name={`members.${index}.email`} 
                              component="div" 
                              className="mt-1 text-sm text-red-600" 
                            />
                          </div>
                          
                          {values.members.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="inline-flex items-center p-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 rounded-md"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Suggested Users:
                          </h4>
                          <div className="space-y-2">
                            {searchResults.map((searchUser) => (
                              <button
                                key={searchUser.id}
                                type="button"
                                onClick={() => {
                                  // Find empty member slot or add new one
                                  const emptyIndex = values.members.findIndex(m => !m.email);
                                  if (emptyIndex >= 0) {
                                    setFieldValue(`members.${emptyIndex}.email`, searchUser.email);
                                  } else {
                                    push({ email: searchUser.email });
                                  }
                                  setSearchResults([]);
                                }}
                                className="flex items-center space-x-2 w-full text-left p-2 hover:bg-gray-100 rounded"
                              >
                                <div className="flex-shrink-0 h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-medium text-primary-600">
                                    {searchUser.first_name?.[0]}{searchUser.last_name?.[0]}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {searchUser.first_name} {searchUser.last_name}
                                  </p>
                                  <p className="text-xs text-gray-500">{searchUser.email}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {searchLoading && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <LoadingSpinner size="sm" />
                          <span>Searching users...</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => push({ email: '' })}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Another Member
                      </button>
                    </div>
                  )}
                </FieldArray>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        Member Invitations
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <ul className="list-disc list-inside space-y-1">
                          <li>Members will receive email invitations to join the group</li>
                          <li>They need to register if they don't have an account</li>
                          <li>You can add more members later from the group details page</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate('/groups')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createGroupMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(isSubmitting || createGroupMutation.isLoading) && <ButtonSpinner />}
                  Create Group
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}

export default CreateGroupPage;