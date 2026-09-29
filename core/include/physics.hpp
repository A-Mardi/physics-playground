#pragma once
// C ABI: pixel units, positive Y down, radians, fixed steps <= 25 ms.
extern "C" {
void world_reset();
int body_add(int shape, float x, float y, float width, float height, float angle, int fixed);
void body_remove(int id);
void body_move(int id, float x, float y, float angle);
void body_velocity(int id, float vx, float vy, float angular);
int body_pick(float x, float y);
void world_gravity(float x, float y);
void world_material(float bounce, float friction);
void world_step(float dt);
int world_count();
int world_contacts();
int world_candidates();
float *world_data();
}
