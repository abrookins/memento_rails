class CreateMemories < ActiveRecord::Migration
  def self.up
    create_table :memories do |t|
      t.string :title
      t.text :description
      t.string :place
      t.integer :lat
      t.integer :lon
      t.datetime :date
      t.datetime :created_at
      t.datetime :updated_at
      t.string :author

      t.timestamps
    end
  end

  def self.down
    drop_table :memories
  end
end
