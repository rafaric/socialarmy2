import { v4 as uuidv4 } from "uuid";

export async function fperfil(userId, supabase, setProfile) {
  // console.log(userId);
  const { data } = await supabase.from("profiles").select("*").eq("id", userId);
  // console.log(data);
  return setProfile(data?.[0]);
}

export async function fposts(supabase, setPosts) {
  const { data } = await supabase
    .from("posts")
    .select(
      "id, content, created_at, photos, tagged, profiles(id, name, avatar)"
    )
    .is("parent", null)
    .order("created_at", { ascending: false });

  return setPosts(data);
}
export async function frangeposts(supabase, setPosts, pageSize, page) {
  const { data } = await supabase
    .from("posts")
    .select(
      "id, content, created_at, photos, tagged, profiles(id, name, avatar)"
    )
    .is("parent", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  return setPosts((prevPosts) => [...prevPosts, ...data]);
}

export async function fLikes(supabase, id, setLikes) {
  const { data } = await supabase.from("likes").select().eq("post_id", id);
  return setLikes(data);
}
export async function fUserLikes(supabase, id, userId, setAlreadyLiked) {
  const { data } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", id);
  if (data && data?.length > 0) {
    // User already liked the post, remove like
    return setAlreadyLiked(true);
  } else {
    // User did not like the post yet, add like
    return setAlreadyLiked(false);
  }
}

export async function fComments(supabase, id, setComments) {
  const { data } = await supabase
    .from("posts")
    .select("*, profiles(*)")
    .eq("parent", id);
  return setComments(data);
}

export async function fuserPosts(supabase, userId, setPosts) {
  const { data } = await supabase
    .from("posts")
    .select(
      "id, content, created_at, author, photos, profiles(id, name, avatar)"
    )
    .is("parent", null)
    .eq("author", userId);
  return setPosts(data);
}

async function createNotification(
  notificationType,
  fromUserId,
  toUserId,
  postId = null
) {
  const { data } = await supabase.from("notifications").insert([
    {
      notification_type: notificationType,
      user_emisor: fromUserId,
      user_receptor: toUserId,
      post_id: postId,
    },
  ]);

  return data[0];
}

const getFriendIds = async (supabase, userId) => {
  const { data: friendIds, error } = await supabase
    .from("friends")
    .select("friend_id")
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    return [];
  }

  return friendIds.map(({ friend_id }) => friend_id);
};

export const fFriends = async (supabase, userId, setFriends) => {
  const friendIds = await getFriendIds(supabase, userId);

  if (!friendIds?.length) {
    return [];
  }

  const { data: friends, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", friendIds);

  if (error) {
    console.error(error);
    return [];
  }
  // console.log(friends);
  return setFriends(friends);
};

export const crearPost = async (
  supabase,
  userId,
  content,
  uploads,
  setContent,
  setUploads,
  selectedFriends,
  setSelectedFriends,
  friends
) => {
  if (content !== "") {
    supabase
      .from("posts")
      .insert({
        author: userId,
        content,
        photos: uploads,
        tagged: selectedFriends,
      })
      .then(async (response) => {
        if (!response.error) {
          const { data: posts, error } = await supabase
            .from("posts")
            .select("*")
            .order("id", { ascending: false })
            .limit(1)
            .then((response) =>
              friends.map(
                async (friend) =>
                  await supabase.from("notifications").insert([
                    {
                      notification_type: "post",
                      user_emisor: userId,
                      user_receptor: friend.id,
                      post_id: response.data[0].id,
                    },
                  ])
              )
            );
          setContent("");
          setUploads([]);
          setSelectedFriends([]);
        }
      });
  } else {
    alert("Ingrese un texto");
  }
};

export async function addPhotos(ev, supabase, setUploads, setIsUploading) {
  const files = ev.target.files;
  if (files?.length > 0) {
    setIsUploading(true);
    for (const file of files) {
      console.log(file.type === "image/jpeg");
      const newName = Date.now() + file.name;
      const result = await supabase.storage
        .from("photos")
        .upload(newName, file);
      if (result.data) {
        const url = {
          id: uuidv4(),
          tipo: file.type,
          url:
            process.env.NEXT_PUBLIC_SUPABASE_URL +
            "/storage/v1/object/public/photos/" +
            result.data.path,
        };
        console.log(url);
        setUploads((prevUploads) => [...prevUploads, url]);
      } else {
        console.log(result);
      }
    }
    setIsUploading(false);
  }
}

export function fPhotos(supabase, userId, setPhotos) {
  supabase
    .from("posts")
    .select("photos")
    .eq("author", userId)
    .then((response) => {
      const photosReal = response.data?.filter(
        (elemento) => elemento.photos !== null && elemento.photos?.length > 0
      );
      setPhotos(photosReal);
    });
}

export function tEditarAbout(
  supabase,
  profile,
  setProfile,
  editing,
  setEditing,
  about,
  setAbout
) {
  if (!editing) {
    setEditing(true);
    setAbout(profile.about);
  } else {
    setEditing(false);
    supabase
      .from("profiles")
      .update({
        about,
      })
      .eq("id", profile.id)
      .then(() => {
        fperfil(profile.id, supabase, setProfile);
      });
  }
}

export function fIsSaved(supabase, id, userId, setSavedPost) {
  supabase
    .from("saved_posts")
    .select()
    .eq("post_id", id)
    .eq("user_id", userId)
    .then((result) => {
      if (result?.data?.length > 0) {
        setSavedPost(true);
      } else {
        setSavedPost(false);
      }
    });
}

export function toggleSave(savedPost, setSavedPost, supabase, id, userId) {
  if (savedPost) {
    supabase
      .from("saved_posts")
      .delete()
      .eq("post_id", id)
      .eq("user_id", userId)
      .then(() => {
        setSavedPost(false);
      });
  }
  if (!savedPost) {
    supabase
      .from("saved_posts")
      .insert({
        user_id: userId,
        post_id: id,
      })
      .then(() => {
        setSavedPost(true);
      });
  }
}

export async function fNotifications(supabase, userId, setNotifications) {
  await supabase
    .from("notifications")
    .select("*, profiles:user_receptor(*)")
    .eq("user_emisor", userId)
    .order("created_at", { ascending: false })
    .then((response) => {
      console.log(response.data);
      setNotifications(response.data);
    });
}
