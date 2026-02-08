'use client';

import { Suspense, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { registerRequestSchema } from '@doc-store/shared';
import type { RegisterRequest, AuthResponse } from '@doc-store/shared';
import { useAuthStore } from '@/lib/stores/auth.store';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      inviteToken: token ?? '',
    },
  });

  useEffect(() => {
    if (token) {
      setValue('inviteToken', token);
    }
  }, [token, setValue]);

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-semibold">Registration</h2>
        <p className="mt-2 text-sm text-foreground/60">
          An invitation token is required to register. Please use the link from your
          invitation email.
        </p>
      </div>
    );
  }

  const onSubmit = async (data: RegisterRequest) => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Registration failed');
        return;
      }

      const authData: AuthResponse = await res.json();
      setAuth(authData);
      router.push('/vaults');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-lg font-semibold">Create your account</h2>

      {error && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          className="w-full rounded border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          autoComplete="name"
          {...register('displayName')}
          className="w-full rounded border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
        />
        {errors.displayName && (
          <p className="mt-1 text-xs text-red-600">{errors.displayName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className="w-full rounded border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
        />
        {errors.password && (
          <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      <input type="hidden" {...register('inviteToken')} />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>

      <p className="text-center text-xs text-foreground/50">
        Already have an account?{' '}
        <a href="/login" className="underline hover:text-foreground">
          Sign in
        </a>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-foreground/50">Loading...</div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
