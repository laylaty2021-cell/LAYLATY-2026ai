"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Product, Service } from "@/lib/types";
import { CreateProductForm } from "./create-product-form";
import { CreateServiceForm } from "./create-service-form";

function formatPrice(amount: string, currency: string) {
  return `${Number(amount).toLocaleString()} ${currency}`;
}

export default function StoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = use(params);
  const { status } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [productList, serviceList] = await Promise.all([
        apiFetch<Product[]>(`/merchant/stores/${storeId}/products`),
        apiFetch<Service[]>(`/merchant/stores/${storeId}/services`),
      ]);
      setProducts(productList);
      setServices(serviceList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load catalog");
    }
  }, [storeId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [status, router, loadData]);

  if (status !== "authenticated" || products === null || services === null) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">{error ?? "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/dashboard" className="mb-6 inline-block text-sm text-zinc-500 underline">
        ← Back to dashboard
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-zinc-900">Catalog</h1>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-10">
        <section>
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Products</h2>
          {products.length > 0 && (
            <ul className="mb-4 space-y-2">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{product.name}</p>
                    <p className="text-sm text-zinc-500">/{product.slug}</p>
                  </div>
                  <p className="text-sm font-medium text-zinc-700">
                    {formatPrice(product.basePrice, product.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <CreateProductForm storeId={storeId} onCreated={loadData} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Services</h2>
          {services.length > 0 && (
            <ul className="mb-4 space-y-2">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{service.name}</p>
                    <p className="text-sm text-zinc-500">
                      /{service.slug}
                      {service.durationMinutes ? ` · ${service.durationMinutes} min` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-zinc-700">
                    {formatPrice(service.price, service.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <CreateServiceForm storeId={storeId} onCreated={loadData} />
          </div>
        </section>
      </div>
    </main>
  );
}
