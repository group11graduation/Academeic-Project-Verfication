import React, { useState, useEffect } from 'react';
import { api, User, Building } from '../api/users.api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Badge } from '../components/Badge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    userId: '',
    role: 'tenant',
    firstName: '',
    lastName: '',
    phone: '',
    buildingId: '',
    managerId: '',
  });

  // Fetch users and buildings
  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, buildingsData] = await Promise.all([
        api.getUsers(selectedRole),
        api.getBuildings(),
      ]);
      setUsers(usersData);
      setBuildings(buildingsData);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedRole]);

  const resetForm = () => {
    setFormData({
      userId: '',
      role: 'tenant',
      firstName: '',
      lastName: '',
      phone: '',
      buildingId: '',
      managerId: '',
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUserProfile(formData);
      toast.success('User profile created successfully');
      setIsCreateModalOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error('Failed to create user profile');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedUser.profile) return;
    try {
      await api.updateUserProfile(selectedUser.profile._id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        buildingId: formData.buildingId || undefined,
        managerId: formData.managerId || undefined,
        isActive: true,
      });
      toast.success('User profile updated successfully');
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch {
      toast.error('Failed to update user profile');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      userId: user._id,
      role: user.profile?.role || 'tenant',
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      phone: user.profile?.phone || '',
      buildingId: user.profile?.buildingId || '',
      managerId: user.profile?.managerId || '',
    });
    setIsEditModalOpen(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'danger';
      case 'manager': return 'warning';
      case 'sub_manager': return 'info';
      case 'tenant': return 'success';
      default: return 'default';
    }
  };

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'sub_manager', label: 'Sub Manager' },
    { value: 'tenant', label: 'Tenant' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage user profiles and roles</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      {/* Role Filter */}
      <div className="flex items-center space-x-4">
        <Select
          label="Filter by Role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          options={roleOptions}
        />
      </div>

      {/* User Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(user => (
          <Card key={user._id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {user.profile?.firstName} {user.profile?.lastName}
                </CardTitle>
                <Badge variant={getRoleBadgeVariant(user.profile?.role || '')}>
                  {user.profile?.role?.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Email: {user.email || 'Not provided'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Phone: {user.profile?.phone || 'Not provided'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Status: {user.profile?.isActive ? 'Active' : 'Inactive'}
              </p>
              <Button size="sm" variant="outline" onClick={() => openEditModal(user)} className="w-full">
                <PencilIcon className="h-4 w-4 mr-1" /> Edit Profile
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modals */}
      {/* Create User Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create User Profile">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input label="User ID" value={formData.userId} onChange={(e) => setFormData({ ...formData, userId: e.target.value })} required />
          <Select label="Role" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} options={[
            { value: 'tenant', label: 'Tenant' },
            { value: 'sub_manager', label: 'Sub Manager' },
            { value: 'manager', label: 'Manager' },
            { value: 'super_admin', label: 'Super Admin' },
          ]} required />
          <Input label="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
          <Input label="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
          <Input label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Optional" />
          <Select label="Building" value={formData.buildingId} onChange={(e) => setFormData({ ...formData, buildingId: e.target.value })} options={[{ value: '', label: 'No Building Assignment' }, ...buildings.map(b => ({ value: b._id, label: b.name }))]} />
          <div className="flex space-x-3 pt-4">
            <Button type="submit" className="flex-1">Create Profile</Button>
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit User Profile">
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <Input label="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
          <Input label="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
          <Input label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          <Select label="Building" value={formData.buildingId} onChange={(e) => setFormData({ ...formData, buildingId: e.target.value })} options={[{ value: '', label: 'No Building Assignment' }, ...buildings.map(b => ({ value: b._id, label: b.name }))]} />
          <div className="flex space-x-3 pt-4">
            <Button type="submit" className="flex-1">Update Profile</Button>
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
