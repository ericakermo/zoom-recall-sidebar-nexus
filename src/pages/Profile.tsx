
import React from 'react';

const Profile = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">User Profile</h1>
      <div className="bg-white dark:bg-neutral-800 shadow rounded-lg p-6">
        <div className="flex items-center space-x-6 mb-4">
          <div className="h-24 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div>
            <h2 className="text-xl font-medium">User Name</h2>
            <p className="text-gray-500 dark:text-gray-400">user@example.com</p>
          </div>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h3 className="text-lg font-medium mb-2">Account Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-100 dark:bg-neutral-700 p-3 rounded-md">
              <p className="text-sm text-gray-500 dark:text-gray-400">Account Type</p>
              <p className="font-medium">Standard</p>
            </div>
            <div className="bg-gray-100 dark:bg-neutral-700 p-3 rounded-md">
              <p className="text-sm text-gray-500 dark:text-gray-400">Member Since</p>
              <p className="font-medium">Jan 01, 2023</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
