"use client";
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Swal from 'sweetalert2';
export default function ForgotPassword() {
  const [formData, setFormData] = useState({
    email: "",
    customerId: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Call reset password API
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          customerId: formData.customerId
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      // Show success message
      await Swal.fire({
        title: 'Password Reset Successful',
        text: 'A new password has been sent to your email address',
        icon: 'success',
        confirmButtonText: 'OK'
      });

      // Redirect to login
      window.location.href = '/';

    } catch (err) {
      await Swal.fire({
        title: 'Password Reset Failed',
        text: err instanceof Error ? err.message : 'An error occurred',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      {/* Logo Header */}
      <div className="mb-8 text-center">
        <Image 
          src="/logo.svg"
          alt="Company Logo"
          width={150}
          height={50}
          className="logo w-[150px] h-auto"
          priority
        />
      </div>

      {/* Reset Password Form */}
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
          Reset Password
        </h2>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email address"
              required
            />
          </div>

          {/* Customer ID Input */}
          <div>
            <label htmlFor="customerId" className="block text-sm font-medium text-gray-700">
              Company ID
            </label>
            <input
              type="text"
              id="customerId"
              name="customerId"
              value={formData.customerId}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your customer ID"
              required
            />
          </div>

          {/* Reset Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : 'Reset Password'}
          </button>

          {/* Back to Login Link */}
          <div className="text-center mt-4">
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-500">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
