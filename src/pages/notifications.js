import Avatar from "@/components/Avatar";
import Card from "@/components/Card";
import Layout from "@/components/Layout";
import React, { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { UserContext } from "@/contexts/UserContext";
import { fNotifications } from "@/utils/fperfil";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";

function NotificationsPage() {
  const { profile } = useContext(UserContext);
  const [notifications, setNotifications] = useState([]);
  const supabase = useSupabaseClient();
  const session = useSession();
  const [perfiles, setPerfiles] = useState([]);

  useEffect(() => {
    fNotifications(supabase, session?.user.id, setNotifications);
  }, []);

  return (
    <Layout>
      <h1 className="md:text-2xl text-lg text-center uppercase font-bold text-white mb-6">
        Notificaciones
      </h1>
      <Card>
        {notifications &&
          notifications?.map((noti) => (
            <div key={noti.id} className="flex flex-col gap-4">
              <div className="flex items-center gap-3 py-2 border-b-2">
                <Link href="/profile" className="hover:opacity-30">
                  {" "}
                  <Avatar url={noti.profiles?.avatar} />
                </Link>
                <p>
                  <Link
                    href={`/profile/${noti.profiles.id}`}
                    className="font-bold hover:text-purple-300"
                  >
                    {noti.profiles?.name}
                  </Link>{" "}
                  {noti.notification_type === "like" &&
                    "le ha dado like a tu post"}
                  {noti.notification_type === "comentario" &&
                    "ha comentado tu post"}
                </p>
              </div>
            </div>
          ))}
      </Card>
    </Layout>
  );
}

export default NotificationsPage;
