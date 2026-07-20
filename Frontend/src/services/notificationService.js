import api from '../lib/api';

const list = async ({ limit = 40, unreadOnly = false } = {}) => {
  const response = await api.get('/notifications', {
    params: {
      limit,
      unreadOnly: unreadOnly ? '1' : undefined,
    },
  });
  return response.data;
};

const unreadCount = async () => {
  const response = await api.get('/notifications/unread-count');
  return response.data;
};

const markRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

const markAllRead = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data;
};

const notificationService = {
  list,
  unreadCount,
  markRead,
  markAllRead,
};

export default notificationService;
