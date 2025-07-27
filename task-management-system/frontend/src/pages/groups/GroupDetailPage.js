import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { groupService, userService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner, { ButtonSpinner } from '../../components/ui/LoadingSpinner';

// Validation schema for group editing
const groupEditSchema = Yup.object().shape({
  name: Yup.string()
    .min(3, 'Group name must be at least 3 characters')
    .max(100, 'Group name must be less than 100 characters')
    .required('Group name is required'),
  description: Yup.string()
    .max(500, 'Description must be less than 500 characters'),
});

// Validation schema for adding members
const addMemberSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
});

function GroupDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Fetch group details
  const { data: groupData, isLoading, error } = useQuery(
    ['group', id],
    () => groupService.getGroup(id),
    {
      enabled: !!id && user?.user_type === 'group_admin',
    }
  );

  // Update group mutation
  const updateGroupMutation = useMutation(
    ({ groupId, groupData }) => groupService.updateGroup(groupId, groupData),
    {
      onSuccess: () => {
        toast.success('Group updated successfully!');
        queryClient.invalidateQueries(['group', id]);
        queryClient.invalidateQueries('groups');
        setIsEditing(false);
      },
      onError: (error) => {
        const message = error.response?.data?.message || 'Failed to update group';
        toast.error(message);
      },
    }
  );

  // Add member mutation
  const addMemberMutation = useMutation(
    ({ groupId, memberData }) => groupService.addMember(groupId, memberData),
    {
      onSuccess: () => {
        toast.success('Member added successfully!');
        queryClient.invalidateQueries(['group', id]);
        queryClient.invalidateQueries('groups');
        setShowAddMember(false);
        setSearchResults([]);
      },
      onError: (error) => {
        const message = error.response?.data?.message || 'Failed to add member';
        toast.error(message);
      },
    }
  );

  // Remove member mutation
  const removeMemberMutation = useMutation(
    ({ groupId, userId }) => groupService.removeMember(groupId, userId),
    {
      onSuccess: () => {
        toast.success('Member removed successfully!');
        queryClient.invalidateQueries(['group', id]);
        queryClient.invalidateQueries('groups');
        setMemberToRemove(null);
      },
      onError: (error) => {
        const message = error.response?.data?.message || 'Failed to remove member';
        toast.error(message);
      },
    }
  );

  // Delete group mutation
  const deleteGroupMutation = useMutation(groupService.deleteGroup, {
    onSuccess: () => {
      toast.success('Group deleted successfully!');
      queryClient.invalidateQueries('groups');
      navigate('/groups');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to delete group';
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
      // Filter out existing members
      const existingMemberEmails = group?.members?.map(m => m.email) || [];
      const filteredUsers = (response.data?.users || []).filter(
        searchUser => !existingMemberEmails.includes(searchUser.email)
      );
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleGroupUpdate = async (values, { setSubmitting }) => {
    try {
      await updateGroupMutation.mutateAsync({ groupId: id, groupData: values });
    } catch (error) {
      console.error('Error updating group:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = async (values, { setSubmitting, resetForm }) => {
    try {
      await addMemberMutation.mutateAsync({ groupId: id, memberData: values });
      resetForm();
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = (userId) => {
    removeMemberMutation.mutate({ groupId: id, userId });
  };

  const handleDeleteGroup = () => {
    deleteGroupMutation.mutate(id);
    setShowDeleteConfirm(false);
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
          Only group administrators can access this page.
        </p>
        <div className="mt-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

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
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading group</h3>
        <p className="mt-1 text-sm text-gray-500">Unable to load group details. Please try again.</p>
        <div className="mt-6">
          <Link
            to="/groups"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Groups
          </Link>
        </div>
      </div>
    );
  }

  const group = groupData?.data;

  if (!group) {
    return (
      <div className="text-center py-12">
        <h3 className="mt-2 text-sm font-medium text-gray-900">Group not found</h3>
        <p className="mt-1 text-sm text-gray-500">The group you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/groups"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Groups
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/groups"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Groups
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {!isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Group
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                >
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Group
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Group Details */}
          <div className="bg-white shadow rounded-lg p-6">
            {isEditing ? (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Edit Group</h2>
                <Formik
                  initialValues={{
                    name: group.name,
                    description: group.description || '',
                  }}
                  validationSchema={groupEditSchema}
                  onSubmit={handleGroupUpdate}
                >
                  {({ isSubmitting, errors, touched }) => (
                    <Form className="space-y-4">
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
                        />
                        <ErrorMessage name="description" component="div" className="mt-1 text-sm text-red-600" />
                      </div>

                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || updateGroupMutation.isLoading}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                        >
                          {(isSubmitting || updateGroupMutation.isLoading) && <ButtonSpinner />}
                          Save Changes
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Group Details</h2>
                {group.description ? (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{group.description}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No description provided.</p>
                )}
              </div>
            )}
          </div>

          {/* Members List */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Members</h2>
              <button
                onClick={() => setShowAddMember(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
              >
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Member
              </button>
            </div>

            {group.members && group.members.length > 0 ? (
              <div className="space-y-3">
                {group.members.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-600">
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {member.role || 'Member'}
                      </span>
                      {member.user_id !== user.id && (
                        <button
                          onClick={() => setMemberToRemove(member)}
                          className="inline-flex items-center p-1 border border-red-300 text-red-700 bg-white hover:bg-red-50 rounded"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No members in this group yet.</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Group Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Group Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Created by</dt>
                <dd className="text-sm text-gray-900">{group.created_by_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">{new Date(group.created_at).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last updated</dt>
                <dd className="text-sm text-gray-900">{new Date(group.updated_at).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total members</dt>
                <dd className="text-sm text-gray-900">{group.members?.length || 0}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Member</h3>
              <Formik
                initialValues={{ email: '' }}
                validationSchema={addMemberSchema}
                onSubmit={handleAddMember}
              >
                {({ isSubmitting, setFieldValue, values }) => (
                  <Form className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <Field
                        id="email"
                        name="email"
                        type="email"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        placeholder="Enter member email"
                        onChange={(e) => {
                          setFieldValue('email', e.target.value);
                          searchUsers(e.target.value);
                        }}
                      />
                      <ErrorMessage name="email" component="div" className="mt-1 text-sm text-red-600" />
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Suggested Users:</h4>
                        <div className="space-y-2">
                          {searchResults.map((searchUser) => (
                            <button
                              key={searchUser.id}
                              type="button"
                              onClick={() => {
                                setFieldValue('email', searchUser.email);
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

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddMember(false);
                          setSearchResults([]);
                        }}
                        className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || addMemberMutation.isLoading}
                        className="px-4 py-2 bg-primary-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-primary-600 disabled:opacity-50"
                      >
                        {(isSubmitting || addMemberMutation.isLoading) && <ButtonSpinner />}
                        Add Member
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-2">Remove Member</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to remove {memberToRemove.first_name} {memberToRemove.last_name} from this group?
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => setMemberToRemove(null)}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRemoveMember(memberToRemove.user_id)}
                    disabled={removeMemberMutation.isLoading}
                    className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    {removeMemberMutation.isLoading && <ButtonSpinner />}
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-2">Delete Group</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this group? This will also remove all associated tasks and cannot be undone.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteGroup}
                    disabled={deleteGroupMutation.isLoading}
                    className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleteGroupMutation.isLoading && <ButtonSpinner />}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupDetailPage;