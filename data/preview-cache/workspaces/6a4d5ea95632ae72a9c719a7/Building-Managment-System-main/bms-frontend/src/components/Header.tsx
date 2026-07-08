import React from 'react';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';
import { SignOutButton } from '../SignOutButton';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  onMenuClick: () => void;
  user: any;
}

export function Header({ onMenuClick, user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          
          <div className="ml-4 lg:ml-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Building Management System
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <ThemeToggle />
          
          <button className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
            <BellIcon className="h-6 w-6" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.profile?.firstName} {user?.profile?.lastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.profile?.role?.replace('_', ' ')}
              </p>
            </div>
            
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.profile?.firstName?.[0]}{user?.profile?.lastName?.[0]}
              </span>
            </div>
          </div>

          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
