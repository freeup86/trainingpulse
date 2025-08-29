#!/usr/bin/env node

/**
 * Script to add default deliverables to existing courses that don't have any
 * This fixes courses created before deliverables were made required
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixMissingDeliverables() {
  const client = await pool.connect();
  
  try {
    console.log('Starting to fix missing deliverables...\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Find courses without deliverables
    const coursesWithoutDeliverables = await client.query(`
      SELECT c.id, c.title, c.modality
      FROM courses c
      LEFT JOIN course_deliverables cd ON c.id = cd.course_id
      WHERE cd.id IS NULL
      AND c.modality IN ('ILT/VLT', 'Micro Learning')
      ORDER BY c.created_at DESC
    `);
    
    console.log(`Found ${coursesWithoutDeliverables.rows.length} courses without deliverables\n`);
    
    if (coursesWithoutDeliverables.rows.length === 0) {
      console.log('No courses need fixing!');
      await client.query('COMMIT');
      return;
    }
    
    // Get default deliverables for each modality
    const modalityDeliverables = await client.query(`
      SELECT md.modality, md.deliverable_id, d.name
      FROM modality_deliverables md
      JOIN deliverables d ON md.deliverable_id = d.id
      WHERE md.modality IN ('ILT/VLT', 'Micro Learning')
      AND d.is_active = true
      ORDER BY md.modality, d.name
    `);
    
    // Group deliverables by modality
    const deliverablesByModality = {};
    modalityDeliverables.rows.forEach(row => {
      if (!deliverablesByModality[row.modality]) {
        deliverablesByModality[row.modality] = [];
      }
      deliverablesByModality[row.modality].push({
        id: row.deliverable_id,
        name: row.name
      });
    });
    
    console.log('Default deliverables by modality:');
    Object.entries(deliverablesByModality).forEach(([modality, deliverables]) => {
      console.log(`  ${modality}: ${deliverables.map(d => d.name).join(', ')}`);
    });
    console.log('');
    
    // Add deliverables to each course
    let totalAdded = 0;
    for (const course of coursesWithoutDeliverables.rows) {
      const deliverables = deliverablesByModality[course.modality] || [];
      
      if (deliverables.length === 0) {
        console.log(`⚠️  No default deliverables found for ${course.modality}: ${course.title}`);
        continue;
      }
      
      console.log(`Adding ${deliverables.length} deliverables to "${course.title}" (${course.modality})`);
      
      for (const deliverable of deliverables) {
        await client.query(`
          INSERT INTO course_deliverables (course_id, deliverable_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [course.id, deliverable.id]);
        totalAdded++;
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`\n✅ Successfully added ${totalAdded} deliverable associations`);
    console.log('Fixed courses will now show their deliverables in the course details page.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fixing deliverables:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the script
fixMissingDeliverables().catch(console.error);