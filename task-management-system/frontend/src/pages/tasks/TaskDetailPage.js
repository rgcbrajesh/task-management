import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { taskService, groupService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner, { ButtonSpinner } from '../../components/ui/LoadingSpinner';

// Validation schema for task editing
const taskEditSchema = Yup.object().shape({
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
    .required('Start time is required'),
  end_time: Yup.date()
    .min(Yup.ref('start_time'), 'End time must be after start time')
    .required('End time is required'),
  status: Yup.string()
    .oneOf(['pending', 'in_progress', 'completed', 'overdue'], 'Invalid status')
    .required('Status is required'),
});

function TaskDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch task details
  const { data: taskData, isLoading, error } = useQuery(
    ['task', id],
    () => taskService.getTask(id),
    {
      enabled: !!id,
    }
  );

  // Update task mutation
  const updateTaskMutation = useMutation(
    ({ taskId, taskData }) => taskService.updateTask(taskId, taskData),
    {
      onSuccess: () => {
        toast.success('Task updated successfully!');
        queryClient.invalidateQueries(['task', id]);
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries('dashboard');
        setIsEditing(false);
      },
      onError: (error) => {
        const message = error.response?.data?.message || 'Failed to update task';
        toast.error(message);
      },
    }
  );

  // Update task status mutation
  const updateStatusMutation = useMutation(
    ({ taskId, status }) => taskService.updateTaskStatus(taskId, { status }),
    {
      onSuccess: () => {
        toast.success('Task status updated successfully!');
        queryClient.invalidateQueries(['task', id]);
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries('dashboard');
      },
      onError: (error) => {
        const message = error.response?.data?.message || 'Failed to update status';
        toast.error(message);
      },
    }
  );

  // Delete task mutation
  const deleteTaskMutation = useMutation(taskService.deleteTask, {
    onSuccess: () => {
      toast.success('Task deleted successfully!');
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('dashboard');
      navigate('/tasks');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to delete task';
      toast.error(message);
    },
  });

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const taskData = {
        ...values,
        start_time: new Date(values.start_time).toISOString(),
        end_time: new Date(values.end_time).toISOString(),
      };

      await updateTaskMutation.mutateAsync({ taskId: id, taskData });
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    updateStatusMutation.mutate({ taskId: id, status: newStatus });
  };

  const handleDelete = () => {
    deleteTaskMutation.mutate(id);
    setShowDeleteConfirm(false);
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityClasses = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityClasses[priority]}`}>
        {priority}
      </span>
    );
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDateTimeForInput = (dateString) => {
    return new Date(dateString).toISOString().slice(0, 16);
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
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading task</h3>
        <p className="mt-1 text-sm text-gray-500">Unable to load task details. Please try again.</p>
        <div className="mt-6">
          <Link
            to="/tasks"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Tasks
          </Link>
        </div>
      </div>
    );
  }

  const task = taskData?.data?.data?.task;
  console.log("Task data:", task);
  if (!task) {
    return (
      <div className="text-center py-12">
        <h3 className="mt-2 text-sm font-medium text-gray-900">Task not found</h3>
        <p className="mt-1 text-sm text-gray-500">The task you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/tasks"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Tasks
          </Link>
        </div>
      </div>
    );
  }

  // Check if user can edit this task
  const canEdit = task.created_by === user?.id || task.assigned_to === user?.id || user?.user_type === 'group_admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/tasks"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Tasks
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
              <div className="mt-1 flex items-center space-x-2">
                {getStatusBadge(task.status)}
                {getPriorityBadge(task.priority)}
              </div>
            </div>
          </div>
          
          {canEdit && (
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
                    Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                  >
                    <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            /* Edit Form */
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Edit Task</h2>
              <Formik
                initialValues={{
                  title: task.title,
                  description: task.description || '',
                  priority: task.priority,
                  start_time: formatDateTimeForInput(task.start_time),
                  end_time: formatDateTimeForInput(task.end_time),
                  status: task.status,
                }}
                validationSchema={taskEditSchema}
                onSubmit={handleSubmit}
              >
                {({ isSubmitting, errors, touched }) => (
                  <Form className="space-y-4">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                        Title *
                      </label>
                      <Field
                        id="title"
                        name="title"
                        type="text"
                        className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                          errors.title && touched.title ? 'border-red-300' : ''
                        }`}
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
                        className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                          errors.description && touched.description ? 'border-red-300' : ''
                        }`}
                      />
                      <ErrorMessage name="description" component="div" className="mt-1 text-sm text-red-600" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                          Priority *
                        </label>
                        <Field
                          as="select"
                          id="priority"
                          name="priority"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </Field>
                      </div>

                      <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                          Status *
                        </label>
                        <Field
                          as="select"
                          id="status"
                          name="status"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="overdue">Overdue</option>
                        </Field>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
                          Start Time *
                        </label>
                        <Field
                          id="start_time"
                          name="start_time"
                          type="datetime-local"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
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
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                        <ErrorMessage name="end_time" component="div" className="mt-1 text-sm text-red-600" />
                      </div>
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
                        disabled={isSubmitting || updateTaskMutation.isLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {(isSubmitting || updateTaskMutation.isLoading) && <ButtonSpinner />}
                        Save Changes
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          ) : (
            /* View Mode */
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Task Details</h2>
              
              {task.description && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Start Time</h3>
                  <p className="text-sm text-gray-900">{formatDateTime(task.start_time)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">End Time</h3>
                  <p className="text-sm text-gray-900">{formatDateTime(task.end_time)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Status Update */}
          {!isEditing && canEdit && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Status Update</h2>
              <div className="flex flex-wrap gap-2">
                {['pending', 'in_progress', 'completed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={task.status === status || updateStatusMutation.isLoading}
                    className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                      task.status === status
                        ? 'border-primary-300 text-primary-700 bg-primary-50 cursor-not-allowed'
                        : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                    } disabled:opacity-50`}
                  >
                    {updateStatusMutation.isLoading && <ButtonSpinner />}
                    Mark as {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Task Information</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Created by</dt>
                <dd className="text-sm text-gray-900">{task.created_by_name}</dd>
              </div>
              {task.assigned_to_name && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Assigned to</dt>
                  <dd className="text-sm text-gray-900">{task.assigned_to_name}</dd>
                </div>
              )}
              {task.group_name && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Group</dt>
                  <dd className="text-sm text-gray-900">{task.group_name}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">{formatDateTime(task.created_at)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Last updated</dt>
                <dd className="text-sm text-gray-900">{formatDateTime(task.updated_at)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-2">Delete Task</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this task? This action cannot be undone.
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
                    onClick={handleDelete}
                    disabled={deleteTaskMutation.isLoading}
                    className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleteTaskMutation.isLoading && <ButtonSpinner />}
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

export default TaskDetailPage;