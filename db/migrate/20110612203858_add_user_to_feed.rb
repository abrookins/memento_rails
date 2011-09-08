class AddUserToFeed < ActiveRecord::Migration
  def self.up
    change_table :feeds do |t|
      t.references :user
    end
  end

  def self.down
    change_table :feeds do |t|
      t.remove :user_id
    end
  end
end
