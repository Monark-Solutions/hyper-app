"use client";
import Link from 'next/link'
import { useState } from 'react';
import Image from 'next/image';
import Swal from 'sweetalert2';
import supabase from '@/lib/supabase';
import { comparePasswords } from '@/utils/password';

type Customer = {
  customerid: number;
  companyname: string;
  contactname: string;
}

type UserData = {
  username: string;
  password: string;
  customers: Customer;
}

export default function Home() {
  const [formData, setFormData] = useState({
    customerId: "",
    username: "",
    password: ""
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
      // Get user data - may return multiple records
      const { data: usersData, error: userError } = await supabase
        .from('users')
        .select(`
          username,
          password,
          customers!inner(
            customerid,
            companyname,
            contactname
          )
        `)
        .eq('customers.customerid', parseInt(formData.customerId))
        .eq('username', formData.username)
        .eq('isactive', true)
        .eq('isdeleted', false)
        .eq('customers.isactive', true);

      if (userError) throw new Error(userError.message);
      if (!usersData || usersData.length === 0) throw new Error('User not found');

      // Try to find a user with matching password
      let validUser = null;
      for (const userData of usersData) {
        const user = {
          username: userData.username,
          password: userData.password,
          customers: userData.customers
        } as unknown as UserData;

        const isPasswordValid = await comparePasswords(formData.password, user.password);
        if (isPasswordValid) {
          validUser = user;
          break;
        }
      }

      if (validUser) {
        // Store user details in localStorage
        const userDetails = {
          name: validUser.customers.contactname,
          companyName: validUser.customers.companyname,
          customerId: validUser.customers.customerid,
          username: validUser.username
        };
        localStorage.setItem('userDetails', JSON.stringify(userDetails));

        await Swal.fire({
          title: 'Login Successful!',
          text: `Welcome back, ${validUser.username}!`,
          icon: 'success',
          confirmButtonText: 'OK'
        });
        
        // Redirect to dashboard
        window.location.href = '/dashboard';
      } else {
        await Swal.fire({
          title: 'Invalid Credentials',
          text: 'Please check your customer ID, username, and password',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    } catch (err) {
      await Swal.fire({
        title: 'Login Failed',
        text: err instanceof Error ? err.message : 'Invalid credentials',
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
          className="logo"
        />
      </div>

      {/* Login Form */}
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <form className="space-y-6" onSubmit={handleSubmit}>

          {/* Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your username"
              required
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your password"
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

          {/* Forgot Password Link */}
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
              Forgot password?
            </Link>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>

          {/* Sign Up Link */}
          <div className="text-center mt-4">
            <span className="text-sm text-gray-600">Don&apos;t have an account? </span>
            <Link href="/signup" className="text-sm text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
