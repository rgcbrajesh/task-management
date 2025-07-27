import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { taskService, groupService, userService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner, { ButtonSpinner } from '../../components/ui/LoadingSpinner';

// Validation schema
const taskSchema = Yup.object().shape({
  title: Yup.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters')
    .required('Title is required'),
  description: Yup.string()
    .max(500, 'Description must be less than 500 characters'),
  priority: Yup.string()
    .oneOf(['low', 'medium', 'high'], 'Invalid priority')
    .required('Priority is required'),
  start_time: Yup.date()
    .min(new Date(), 'Start time cannot be in the past')
    .required('Start time is required'),
  end_time: Yup.date()
    .min(Yup.ref('start_time'), 'End time must be after start time')
    .required('End time is required'),
  assigned_to: Yup.number()
    .nullable(),
  group_id: Yup.number()
    .nullable(),
});

function CreateTaskPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Fetch groups if user is group admin
  const { data: groupsData, isLoading: groupsLoading } = useQuery(
    'groups',
    () => groupService.getGroups({ page: 1, limit: 100 }),
    {
      enabled: !!user,
    }
  );

  // Fetch group members when a group is selected
  const { data: groupMembersData, isLoading: membersLoading } = useQuery(
    ['group-members', selectedGroup],
    () => groupService.getGroup(selectedGroup),
    {
      enabled: !!selectedGroup,
    }
  );

  // Create task mutation
  const createTaskMutation = useMutation(taskService.createTask, {
    onSuccess: (response) => {
      toast.success('Task created successfully!');
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('dashboard');
      navigate('/tasks');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to create task';
      toast.error(message);
    },
  });

  const handleSubmit = async (values, { setSubmitting }) => {
    console.log("values", values);
    try {
      // Format dates for API
      const taskData = {
        ...values,
        start_time: new Date(values.start_time).toISOString(),
        end_time: new Date(values.end_time).toISOString(),
        assigned_to: values.assigned_to || null,
        group_id: values.group_id || null,
      };

      await createTaskMutation.mutateAsync(taskData);
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const groups = groupsData?.data?.data?.groups || [];
  console.log("groups", groupsData);
  const groupMembers = groupMembersData?.data?.data?.group?.members || [];
console.log("groupMembers", groupMembersData);
  // Get current date and time for min values
  const now = new Date();
  const currentDateTime = now.toISOString().slice(0, 16);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Task</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create a new task and assign it to yourself or group members
            </p>
          </div>
          <button
            onClick={() => navigate('/tasks')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Tasks
          </button>
        </div>
      </div>

      {/* Task Creation Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <Formik
          initialValues={{
            title: '',
            description: '',
            priority: 'medium',
            start_time: currentDateTime,
            end_time: '',
            assigned_to: '',
            group_id: '',
          }}
          validationSchema={taskSchema}
          onSubmit={handleSubmit}
        >
          {({ isSubmitting, errors, touched, values, setFieldValue }) => (
            <Form className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Task Title *
                  </label>
                  <Field
                    id="title"
                    name="title"
                    type="text"
                    style={{color:"black"}}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      errors.title && touched.title ? 'border-red-300' : ''
                    }`}
                    placeholder="Enter task title"
                  />
                  <ErrorMessage name="title" component="div" className="mt-1 text-sm text-red-600" />
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
                        style={{color:"black"}}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      errors.description && touched.description ? 'border-red-300' : ''
                    }`}
                    placeholder="Enter task description"
                  />
                  <ErrorMessage name="description" component="div" className="mt-1 text-sm text-red-600" />
                </div>
              </div>

              {/* Priority and Timing */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                    Priority *
                  </label>
                  <Field
                    as="select"
                    id="priority"
                    name="priority"
                      style={{color:"black"}}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      errors.priority && touched.priority ? 'border-red-300' : ''
                    }`}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Field>
                  <ErrorMessage name="priority" component="div" className="mt-1 text-sm text-red-600" />
                </div>

                <div>
                  <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                    Start Time *
                  </label>
                  <Field
                    id="start_time"
                    name="start_time"
                    type="datetime-local"
                    min={currentDateTime}
                        style={{color:"black"}}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      errors.start_time && touched.start_time ? 'border-red-300' : ''
                    }`}
                  />
                  <ErrorMessage name="start_time" component="div" className="mt-1 text-sm text-red-600" />
                </div>

                <div>
                  <label htmlFor="end_time" className="block text-sm font-medium text-gray-700">
                    End Time *
                  </label>
                  <Field
                    id="end_time"
                    name="end_time"
                    type="datetime-local"
                        style={{color:"black"}}
                    min={values.start_time || currentDateTime}
                    className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                      errors.end_time && touched.end_time ? 'border-red-300' : ''
                    }`}
                  />
                  <ErrorMessage name="end_time" component="div" className="mt-1 text-sm text-red-600" />
                </div>
              </div>

              {/* Assignment Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment</h3>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="group_id" className="block text-sm font-medium text-gray-700">
                      Assign to Group
                    </label>
                    {groupsLoading ? (
                      <div className="mt-1 flex items-center">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2 text-sm text-gray-500">Loading groups...</span>
                      </div>
                    ) : (
                      <Field
                        as="select"
                        id="group_id"
                        name="group_id"
                          style={{color:"black"}}
                        onChange={(e) => {
                          const groupId = e.target.value;
                          setFieldValue('group_id', groupId);
                          setSelectedGroup(groupId || null);
                          setFieldValue('assigned_to', ''); // Reset assigned user when group changes
                        }}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      >
                        <option value="">Select a group (optional)</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </Field>
                    )}
                  </div>

                  <div>
                    <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700">
                      Assign to Member
                    </label>
                    {membersLoading ? (
                      <div className="mt-1 flex items-center">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2 text-sm text-gray-500">Loading members...</span>
                      </div>
                    ) : (
                      <Field
                        as="select"
                        id="assigned_to"
                        name="assigned_to"
                          style={{color:"black"}}
                        disabled={!selectedGroup}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100"
                      >
                        <option value="">
                          {selectedGroup ? 'Select a member (optional)' : 'Select a group first'}
                        </option>
                        {groupMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.first_name} {member.last_name} ({member.email})
                          </option>
                        ))}
                      </Field>
                    )}
                    {!selectedGroup && (
                      <p className="mt-1 text-xs text-gray-500">
                        Select a group to assign to specific members
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Individual User Assignment */}

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate('/tasks')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createTaskMutation.isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(isSubmitting || createTaskMutation.isLoading) && <ButtonSpinner />}
                  Create Task
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}

export default CreateTaskPage;