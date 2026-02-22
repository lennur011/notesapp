export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_password_protected: boolean;
  image_urls: string[];
  created_at: string;
  updated_at: string;
};
