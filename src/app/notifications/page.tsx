"use client";

import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import Layout from "@/components/Layout";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotifications } from "@/hooks/useNotifications";

function NotificationsPage() {
  const { user } = useAuthStore();
  const { data: notifications = [], isLoading } = useNotifications(user);

  return (
    <Layout>
      <h1 className="md:text-2xl text-lg text-center uppercase font-bold text-white mb-6">
        Notificaciones
      </h1>
      <Card>
        {isLoading && <p className="text-center text-gray-400 py-4">Cargando...</p>}
        {!isLoading && notifications.length === 0 && (
          <p className="text-center text-gray-400 py-4">Sin notificaciones</p>
        )}
        {notifications.map((noti) => (
          <div key={noti.id} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 py-2 border-b-2">
              <Link href={`/profile/${noti.profiles?.id}`} className="hover:opacity-30">
                <Avatar url={noti.profiles?.avatar} />
              </Link>
              <p>
                <Link href={`/profile/${noti.profiles?.id}`} className="font-bold hover:text-purple-300">
                  {noti.profiles?.name}
                </Link>{" "}
                {noti.notification_type === "like" && "le ha dado like a tu post"}
                {noti.notification_type === "comentario" && "ha comentado tu post"}
                {noti.notification_type === "post" && "ha compartido un post"}
              </p>
            </div>
          </div>
        ))}
      </Card>
    </Layout>
  );
}

export default NotificationsPage;
