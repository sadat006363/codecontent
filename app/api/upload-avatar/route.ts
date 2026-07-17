// app/api/upload-avatar/route.ts
import { NextRequest, NextResponseupload-avatar/route.ts` (API جدید)

```typescript
// app/api/upload-avatar/route.ts
import { NextRequest, NextResponse } from } from 'next/server';
import { put } 'next/server';
import { put } from '@vercel/blob';
import { createClient } from '@vercel/blob';
import { createClient } from '@supabase/sup from '@supabase/supabase-abase-js';

const supjs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPabaseAdmin = createClient(
  processABASE_URL!,
  process.env.S.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEYUPABASE_SERVICE_ROLE_KEY!
);

!
);

export async function POST(req: Nextexport async function POST(req: NextRequest) {
 Request) {
  try {
    const form try {
    const formData = await req.formData();
    const file = formData.get('Data = await req.formData();
    const file =avatar') as File;
    const slug formData.get('avatar') as File = formData.get('slug') as string;

    if (!file ||;
    const slug = formData.get('slug') as string;

    if !slug) {
      return NextResponse.json (!file || !slug) {
      return NextResponse.json(
        { error: '(
        { error: 'Avatar and slug areAvatar and slug are required' },
        { status required' },
        { status: 400 }
      );
: 400 }
      );
       }

    // Check file type and size
    if (!file.type.startsWith(' }

    // Check file type and size
    if (!file.type.startsWith('image/'))image/')) {
      return NextResponse.json(
        {
      return NextResponse.json(
        { { error: 'File must be an image error: 'File must be an image' },
        {' },
        { status: 400 status: 400 }
      );
    }
      );
    }
    if (file.size > }
    if (file.size > 2 * 1024 * 1024) {
      2 * 1024 * 1024) {
      return NextResponse.json return NextResponse.json(
        { error(
        { error: 'Image size must: 'Image size must be less than be less than 2MB' },
        { status 2MB' },
        { status: 400 }
      );
    }

    // Convert to: 400 }
      );
    }

    // Convert to Buffer
    const Buffer
    const bytes = await file bytes = await file.arrayBuffer();
   .arrayBuffer();
    const buffer = Buffer.from(bytes const buffer = Buffer.from(bytes);

    // Upload to Bl);

    // Upload to Blob
    constob
    const fileExtension fileExtension = file.name.split('.').pop() || 'png = file.name.split('.').pop() || 'png';
    const fileName = `avatars';
    const fileName = `avatars/${slug}-${Date.now()}.${fileExtension}`/${slug}-${Date.now()}.${fileExtension}`;
    const { url } =;
    const { url } = await await put put(fileName, buffer, {
      access: '(fileName, buffer, {
      access: 'public',
      contentType: file.type,
      tokenpublic',
      contentType: file.type,
      token: process.env.BLOB_READ: process.env.BLOB_READ_WRITE_TOKEN,
    });

   _WRITE_TOKEN,
    });

    // Save to database // Save to database
    const { error } = await supabaseAdmin
    const { error } = await supabaseAdmin
      .from('snippets
      .from('snippets')
      .update')
      .update({ avatar_url: url({ avatar_url: url })
      .eq })
      .eq('slug', slug('slug', slug);

    if ();

    if (error) {
      console.error('Supabase update error:', error);
      returnerror) {
      console.error('Supabase update error:', error);
      return NextResponse.json NextResponse.json(
        { error: '(
        { error: 'Failed to save avatar URL' },
        { status:Failed to save avatar URL' },
        { status: 500 }
      );
    500 }
      );
    }

    return NextResponse.json({
      success: }

    return NextResponse.json({
      success: true,
      avatarUrl: url true,
      avatarUrl: url,
    });
  },
    });
  } catch (error: any) {
    console.error('Avatar catch (error: any) {
    upload error:', error);
    return NextResponse.json(
      console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: error { error: error.message || 'Upload.message || 'Upload failed' },
      failed' },
      { status:  { status: 500 }
    );
  }
}