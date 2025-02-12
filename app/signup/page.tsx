"use client";
import Link from 'next/link'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import supabase from '@/lib/supabase';
import { hashPassword } from '@/utils/password';

export default function SignUp() {
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    username: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Insert customer data
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert([
          {
            companyname: formData.companyName,
            contactname: formData.contactName,
            contactemail: formData.contactEmail,
            registrationdate: new Date().toISOString()
          }
        ])
        .select('customerid')
        .single();

      if (customerError) throw new Error(customerError.message);
      if (!customerData) throw new Error('Failed to create customer');

      // 2. Hash password and insert user data
      const hashedPassword = await hashPassword(formData.password);
      const { error: userError } = await supabase
        .from('users')
        .insert([
          {
            username: formData.username,
            password: hashedPassword,
            customerid: customerData.customerid,
            useremail: formData.contactEmail
          }
        ]);

      if (userError) throw new Error(userError.message);

      // 3. Create folder in MediaLibrary bucket by uploading an empty file
      const { error: storageError } = await supabase.storage
        .from('MediaLibrary')
        .upload(`${customerData.customerid}/.folder`, new Blob([]));

      if (storageError && storageError.message !== 'The resource already exists') {
        throw new Error(storageError.message);
      }

      // Show success alert
      await Swal.fire({
        title: 'Registration Successful!',
        text: `Contact Name: ${formData.contactName}\nCompany ID: ${customerData.customerid}`,
        icon: 'success',
        confirmButtonText: 'OK'
      });

      // Redirect to home
      router.push('/');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      {/* Logo Header */}
      <div className="mb-8 text-center">
        <img className="logo"/>
      </div>

      {/* Signup Form */}
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Company Name Input */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              type="text"
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your company name"
              required
            />
          </div>

          {/* Contact Name Input */}
          <div>
            <label htmlFor="contactName" className="block text-sm font-medium text-gray-700">
              Contact Name
            </label>
            <input
              type="text"
              id="contactName"
              name="contactName"
              value={formData.contactName}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter contact name"
              required
            />
          </div>

          {/* Contact Email Input */}
          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">
              Contact Email
            </label>
            <input
              type="email"
              id="contactEmail"
              name="contactEmail"
              value={formData.contactEmail}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter contact email"
              required
            />
          </div>

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
              placeholder="Choose a username"
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
              placeholder="Choose a password"
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-600 text-sm mt-2">
              {error}
            </div>
          )}

          {/* Register Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>

          {/* Login Link */}
          <div className="text-center mt-4">
            <span className="text-sm text-gray-600">Already have an account? </span>
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-500">
              Login
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
